const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validate, validateQuery, schemas, querySchemas } = require('../middleware/validation');

// Get queue history
router.get('/', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let query = `
            SELECT 
                qh.id, qh.patient_queue_id, qh.action, qh.action_time,
                qh.from_room_id, qh.to_room_id, qh.performed_by, qh.notes,
                pq.hn, pq.patient_name, pq.queue_number, pq.department,
                fr.room_number as from_room_number,
                tr.room_number as to_room_number
            FROM queue_history qh
            LEFT JOIN patient_queues pq ON qh.patient_queue_id = pq.id
            LEFT JOIN examination_rooms fr ON qh.from_room_id = fr.id
            LEFT JOIN examination_rooms tr ON qh.to_room_id = tr.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (start_date) {
            query += ` AND CAST(qh.action_time AS DATE) >= @start_date`;
            params.push({ name: 'start_date', value: start_date });
        }
        
        if (end_date) {
            query += ` AND CAST(qh.action_time AS DATE) <= @end_date`;
            params.push({ name: 'end_date', value: end_date });
        }
        
        if (!start_date && !end_date) {
            // Default to today's history
            query += ` AND CAST(qh.action_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }
        
        query += ` ORDER BY qh.action_time DESC`;

        const request = pool.request();
        params.forEach(param => request.input(param.name, sql.Date, param.value));
        
        const result = await request.query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (error) {
        console.error('Error fetching queue history:', error);
        res.status(500).json({
            error: 'Failed to fetch queue history',
            message: error.message
        });
    }
});

// Get history by patient queue ID
router.get('/queue/:queueId', async (req, res) => {
    try {
        const pool = await getPool();
        const { queueId } = req.params;

        const result = await pool.request()
            .input('queue_id', sql.Int, queueId)
            .query(`
                SELECT 
                    qh.id, qh.action, qh.action_time, qh.performed_by, qh.notes,
                    qh.from_room_id, qh.to_room_id,
                    fr.room_number as from_room_number,
                    tr.room_number as to_room_number
                FROM queue_history qh
                LEFT JOIN examination_rooms fr ON qh.from_room_id = fr.id
                LEFT JOIN examination_rooms tr ON qh.to_room_id = tr.id
                WHERE qh.patient_queue_id = @queue_id
                ORDER BY qh.action_time ASC
            `);

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (error) {
        console.error('Error fetching queue history:', error);
        res.status(500).json({
            error: 'Failed to fetch queue history',
            message: error.message
        });
    }
});

// Get history by room
router.get('/room/:roomId', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { roomId } = req.params;
        const { start_date, end_date } = req.query;

        let query = `
            SELECT 
                qh.id, qh.patient_queue_id, qh.action, qh.action_time,
                qh.performed_by, qh.notes,
                pq.hn, pq.patient_name, pq.queue_number, pq.department,
                CASE 
                    WHEN qh.to_room_id = @room_id THEN 'to'
                    WHEN qh.from_room_id = @room_id THEN 'from'
                    ELSE 'both'
                END as direction
            FROM queue_history qh
            LEFT JOIN patient_queues pq ON qh.patient_queue_id = pq.id
            WHERE (qh.to_room_id = @room_id OR qh.from_room_id = @room_id)
        `;
        
        const params = [{ name: 'room_id', value: roomId }];
        
        if (start_date) {
            query += ` AND CAST(qh.action_time AS DATE) >= @start_date`;
            params.push({ name: 'start_date', value: start_date });
        }
        
        if (end_date) {
            query += ` AND CAST(qh.action_time AS DATE) <= @end_date`;
            params.push({ name: 'end_date', value: end_date });
        }
        
        if (!start_date && !end_date) {
            // Default to today's history
            query += ` AND CAST(qh.action_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }
        
        query += ` ORDER BY qh.action_time DESC`;

        const request = pool.request();
        params.forEach(param => request.input(param.name, param.name === 'room_id' ? sql.VarChar : sql.Date, param.value));
        
        const result = await request.query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (error) {
        console.error('Error fetching room history:', error);
        res.status(500).json({
            error: 'Failed to fetch room history',
            message: error.message
        });
    }
});

// Create history entry manually (for admin purposes)
router.post('/', validate(schemas.createHistoryEntry), async (req, res) => {
    try {
        const pool = await getPool();
        const { patient_queue_id, action, from_room_id, to_room_id, performed_by, notes } = req.body;

        // Check if patient queue exists
        const queueExists = await pool.request()
            .input('queue_id', sql.Int, patient_queue_id)
            .query('SELECT id FROM patient_queues WHERE id = @queue_id');

        if (queueExists.recordset.length === 0) {
            return res.status(404).json({
                error: 'Patient queue not found',
                message: `No queue found with ID ${patient_queue_id}`
            });
        }

        const result = await pool.request()
            .input('patient_queue_id', sql.Int, patient_queue_id)
            .input('action', sql.VarChar, action)
            .input('from_room_id', sql.VarChar, from_room_id || null)
            .input('to_room_id', sql.VarChar, to_room_id || null)
            .input('performed_by', sql.VarChar, performed_by)
            .input('notes', sql.VarChar, notes || null)
            .query(`
                INSERT INTO queue_history 
                (patient_queue_id, action, from_room_id, to_room_id, performed_by, notes)
                OUTPUT INSERTED.*
                VALUES (@patient_queue_id, @action, @from_room_id, @to_room_id, @performed_by, @notes)
            `);

        res.status(201).json({
            success: true,
            data: result.recordset[0],
            message: 'History entry created successfully'
        });
    } catch (error) {
        console.error('Error creating history entry:', error);
        res.status(500).json({
            error: 'Failed to create history entry',
            message: error.message
        });
    }
});

// Get history statistics
router.get('/stats', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        const params = [];
        
        if (start_date && end_date) {
            dateFilter = `WHERE CAST(action_time AS DATE) BETWEEN @start_date AND @end_date`;
            params.push({ name: 'start_date', value: start_date });
            params.push({ name: 'end_date', value: end_date });
        } else if (start_date) {
            dateFilter = `WHERE CAST(action_time AS DATE) >= @start_date`;
            params.push({ name: 'start_date', value: start_date });
        } else if (end_date) {
            dateFilter = `WHERE CAST(action_time AS DATE) <= @end_date`;
            params.push({ name: 'end_date', value: end_date });
        } else {
            // Default to today
            dateFilter = `WHERE CAST(action_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request()
            .query(`
                SELECT 
                    action,
                    COUNT(*) as count,
                    COUNT(DISTINCT patient_queue_id) as unique_patients,
                    MIN(action_time) as first_action,
                    MAX(action_time) as last_action
                FROM queue_history
                ${dateFilter}
                GROUP BY action
                ORDER BY count DESC
            `);

        // Get hourly statistics
        const hourlyStats = await pool.request()
            .query(`
                SELECT 
                    DATEPART(HOUR, action_time) as hour,
                    COUNT(*) as count,
                    COUNT(DISTINCT action) as unique_actions
                FROM queue_history
                ${dateFilter}
                GROUP BY DATEPART(HOUR, action_time)
                ORDER BY hour
            `);

        res.json({
            success: true,
            data: {
                action_stats: result.recordset,
                hourly_stats: hourlyStats.recordset,
                total_actions: result.recordset.reduce((sum, item) => sum + item.count, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching history statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch history statistics',
            message: error.message
        });
    }
});

module.exports = router;
