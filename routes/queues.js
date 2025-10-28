const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validate, validateQuery, schemas, querySchemas } = require('../middleware/validation');

// Get all patient queues
router.get('/', validateQuery(querySchemas.queueFilter), async (req, res) => {
    try {
        const pool = await getPool();
        const { room_id, department, status, priority_level, date } = req.query;

        let query = `
            SELECT 
                pq.id, pq.hn, pq.patient_name, pq.room_id, pq.queue_number,
                pq.status, pq.department, pq.priority_level,
                pq.arrival_time, pq.called_time, pq.completed_time,
                r.room_number, r.room_name, r.floor
            FROM patient_queues pq
            LEFT JOIN examination_rooms r ON pq.room_id = r.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (room_id) {
            query += ` AND pq.room_id = @room_id`;
            params.push({ name: 'room_id', value: room_id });
        }
        
        if (department) {
            query += ` AND pq.department = @department`;
            params.push({ name: 'department', value: department });
        }
        
        if (status) {
            query += ` AND pq.status = @status`;
            params.push({ name: 'status', value: status });
        }
        
        if (priority_level) {
            query += ` AND pq.priority_level = @priority_level`;
            params.push({ name: 'priority_level', value: priority_level });
        }
        
        if (date) {
            query += ` AND CAST(pq.arrival_time AS DATE) = @date`;
            params.push({ name: 'date', value: date });
        } else {
            // Default to today's queues
            query += ` AND CAST(pq.arrival_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }
        
        query += ` ORDER BY pq.priority_level, pq.queue_number`;

        const request = pool.request();
        params.forEach(param => request.input(param.name, sql.VarChar, param.value));
        
        const result = await request.query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (error) {
        console.error('Error fetching patient queues:', error);
        res.status(500).json({
            error: 'Failed to fetch patient queues',
            message: error.message
        });
    }
});

// Get patient queue by ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    pq.id, pq.hn, pq.patient_name, pq.room_id, pq.queue_number,
                    pq.status, pq.department, pq.priority_level,
                    pq.arrival_time, pq.called_time, pq.completed_time,
                    r.room_number, r.room_name, r.floor
                FROM patient_queues pq
                LEFT JOIN examination_rooms r ON pq.room_id = r.id
                WHERE pq.id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Patient queue not found',
                message: `No queue found with ID ${id}`
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error fetching patient queue:', error);
        res.status(500).json({
            error: 'Failed to fetch patient queue',
            message: error.message
        });
    }
});

// Add patient to queue
router.post('/', validate(schemas.addPatientToQueue), async (req, res) => {
    try {
        const pool = await getPool();
        const { hn, patient_name, room_id, department, priority_level, pdate, ptime, status } = req.body;

        // Check if room exists and is active
        const room = await pool.request()
            .input('room_id', sql.VarChar, room_id)
            .query(`
                SELECT id, room_number, status, current_queue 
                FROM examination_rooms 
                WHERE room_number = @room_id AND status = 'active'
            `);

        if (room.recordset.length === 0) {
            return res.status(404).json({
                error: 'Room not found or inactive',
                message: `No active room found with ID ${room_id}`
            });
        }

        // Check if patient is already in queue for today
        const existingQueue = await pool.request()
            .input('hn', sql.VarChar, hn)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT id, status, room_id 
                FROM patient_queues 
                WHERE hn = @hn 
                AND CAST(arrival_time AS DATE) = @today
                AND status IN ('waiting', 'active')
            `);

        if (existingQueue.recordset.length > 0) {
            return res.status(409).json({
                error: 'Patient already in queue',
                message: `Patient ${hn} is already in queue with status: ${existingQueue.recordset[0].status}`
            });
        }

        // Get next queue number for the room
        const nextQueueResult = await pool.request()
            .input('room_id', sql.VarChar, room_id)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT ISNULL(MAX(queue_number), 0) + 1 as next_queue_number
                FROM patient_queues
                WHERE room_id = @room_id
                AND CAST(arrival_time AS DATE) = @today
                AND status != 'cancelled'
            `);

        const nextQueueNumber = nextQueueResult.recordset[0].next_queue_number;

        console.log('Status received:', status, 'Type:', typeof status);
        if (status === 'completed') {
            // Update existing patient queue to completed status
            const result = await pool.request()
                .input('hn', sql.VarChar, hn)
                .input('department', sql.VarChar, department)
                .query(`
                    UPDATE patient_queues 
                    SET status = 'completed', completed_time = GETDATE()
                    WHERE hn = @hn AND department = @department AND status = 'active'
                    SELECT @@ROWCOUNT as affected_rows
                `);

            if (result.recordset[0].affected_rows > 0) {
                // Log the action
                await pool.request()
                    .input('hn', sql.VarChar, hn)
                    .input('department', sql.VarChar, department)
                    .input('action', sql.VarChar, 'completed')
                    .input('to_room_id', sql.VarChar, room_id)
                    .input('performed_by', sql.VarChar, 'SYSTEM')
                    .input('notes', sql.VarChar, `Patient queue completed`)
                    .query(`
                        INSERT INTO queue_history 
                        (patient_queue_id, action, to_room_id, performed_by, notes)
                        SELECT pq.id, @action, @to_room_id, @performed_by, @notes
                        FROM patient_queues pq
                        WHERE pq.hn = @hn AND pq.department = @department
                    `);

                res.status(200).json({
                    success: true,
                    message: `Patient queue completed successfully`
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: `No active patient queue found for HN: ${hn} in department: ${department}`
                });
            }
        } else {

            // Insert patient into queue
            const result = await pool.request()
                .input('hn', sql.VarChar, hn)
                .input('patient_name', sql.VarChar, patient_name)
                .input('room_id', sql.VarChar, room_id)
                .input('queue_number', sql.Int, nextQueueNumber)
                .input('department', sql.VarChar, department)
                .input('priority_level', sql.VarChar, priority_level)
                .input('arrival_time', sql.VarChar, `${pdate}${ptime}`)
                .input('called_time', sql.VarChar, new Date().toISOString().replace(/[-:T]/g, '').substring(0, 12))
                .query(`
                    INSERT INTO patient_queues 
                    (hn, patient_name, room_id, queue_number, department, priority_level, status, arrival_time, called_time)
                    OUTPUT INSERTED.*
                    VALUES (@hn, @patient_name, @room_id, @queue_number, @department, @priority_level, 'active', @arrival_time, @called_time)
                `);

            // Update room's current queue if this is the first patient
            if (room.recordset[0].current_queue === 0) {
                await pool.request()
                    .input('room_id', sql.VarChar, room_id)
                    .input('current_queue', sql.Int, nextQueueNumber)
                    .query('UPDATE examination_rooms SET current_queue = @current_queue WHERE room_number = @room_id');
            }

            // Log the action
            await pool.request()
                .input('patient_queue_id', sql.Int, result.recordset[0].id)
                .input('action', sql.VarChar, 'created')
                .input('to_room_id', sql.VarChar, room_id)
                .input('performed_by', sql.VarChar, 'SYSTEM')
                .input('notes', sql.VarChar, `Patient added to queue #${nextQueueNumber}`)
                .query(`
                    INSERT INTO queue_history 
                    (patient_queue_id, action, to_room_id, performed_by, notes)
                    VALUES (@patient_queue_id, @action, @to_room_id, @performed_by, @notes)
                `);

            res.status(201).json({
                success: true,
                data: result.recordset[0],
                queue_number: nextQueueNumber,
                message: `Patient added to queue #${nextQueueNumber}`
            });
        }
    } catch (error) {
        console.error('Error adding patient to queue2:', error);
        res.status(500).json({
            error: 'Failed to add patient to queue3',
            message: error.message
        });
    }
});

// Update queue status
router.put('/:id/status', validate(schemas.updateQueueStatus), async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;
        const { status, performed_by } = req.body;

        // Check if queue exists
        const existingQueue = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, status as current_status, room_id FROM patient_queues WHERE id = @id');

        if (existingQueue.recordset.length === 0) {
            return res.status(404).json({
                error: 'Patient queue not found',
                message: `No queue found with ID ${id}`
            });
        }

        const currentStatus = existingQueue.recordset[0].current_status;
        const roomId = existingQueue.recordset[0].room_id;

        // Update queue status with timestamp
        let updateQuery = 'UPDATE patient_queues SET status = @status';
        const request = pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.VarChar, status);

        if (status === 'active' && currentStatus === 'waiting') {
            updateQuery += ', called_time = GETDATE()';
        } else if (status === 'completed' && currentStatus === 'active') {
            updateQuery += ', completed_time = GETDATE()';
        }

        updateQuery += ' OUTPUT INSERTED.* WHERE id = @id';

        const result = await request.query(updateQuery);

        // Log the action
        await pool.request()
            .input('patient_queue_id', sql.Int, id)
            .input('action', sql.VarChar, status)
            .input('to_room_id', sql.VarChar, roomId)
            .input('performed_by', sql.VarChar, performed_by)
            .query(`
                INSERT INTO queue_history 
                (patient_queue_id, action, to_room_id, performed_by)
                VALUES (@patient_queue_id, @action, @to_room_id, @performed_by)
            `);

        res.json({
            success: true,
            data: result.recordset[0],
            message: `Queue status updated to ${status}`
        });
    } catch (error) {
        console.error('Error updating queue status:', error);
        res.status(500).json({
            error: 'Failed to update queue status',
            message: error.message
        });
    }
});

// Call next patient in room
router.post('/room/:roomId/call-next', validate(schemas.callNextPatient), async (req, res) => {
    try {
        const pool = await getPool();
        const { roomId } = req.params;
        const { performed_by } = req.body;

        // Check if room exists
        const room = await pool.request()
            .input('room_id', sql.VarChar, roomId)
            .query('SELECT id, current_queue FROM examination_rooms WHERE id = @room_id');

        if (room.recordset.length === 0) {
            return res.status(404).json({
                error: 'Room not found',
                message: `No room found with ID ${roomId}`
            });
        }

        // Mark current patient as completed if exists
        const currentQueue = room.recordset[0].current_queue;
        if (currentQueue > 0) {
            await pool.request()
                .input('room_id', sql.VarChar, roomId)
                .input('queue_number', sql.Int, currentQueue)
                .query(`
                    UPDATE patient_queues 
                    SET status = 'completed', completed_time = GETDATE()
                    WHERE room_id = @room_id AND queue_number = @queue_number AND status = 'active'
                `);
        }

        // Find next waiting patient
        const nextPatientResult = await pool.request()
            .input('room_id', sql.VarChar, roomId)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT TOP 1 id, queue_number
                FROM patient_queues
                WHERE room_id = @room_id
                AND status = 'waiting'
                AND CAST(arrival_time AS DATE) = @today
                ORDER BY
                    CASE priority_level
                        WHEN 'emergency' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'normal' THEN 3
                    END,
                    queue_number ASC
            `);

        if (nextPatientResult.recordset.length > 0) {
            const nextPatient = nextPatientResult.recordset[0];
            
            // Mark patient as active
            await pool.request()
                .input('patient_id', sql.Int, nextPatient.id)
                .query(`
                    UPDATE patient_queues 
                    SET status = 'active', called_time = GETDATE()
                    WHERE id = @patient_id
                `);

            // Update room's current queue
            await pool.request()
                .input('room_id', sql.VarChar, roomId)
                .input('current_queue', sql.Int, nextPatient.queue_number)
                .query('UPDATE examination_rooms SET current_queue = @current_queue WHERE id = @room_id');

            // Log the action
            await pool.request()
                .input('patient_queue_id', sql.Int, nextPatient.id)
                .input('action', sql.VarChar, 'called')
                .input('to_room_id', sql.VarChar, roomId)
                .input('performed_by', sql.VarChar, performed_by)
                .query(`
                    INSERT INTO queue_history 
                    (patient_queue_id, action, to_room_id, performed_by)
                    VALUES (@patient_queue_id, @action, @to_room_id, @performed_by)
                `);

            res.json({
                success: true,
                data: {
                    next_queue_number: nextPatient.queue_number,
                    patient_id: nextPatient.id
                },
                message: `Patient #${nextPatient.queue_number} called`
            });
        } else {
            // No more patients, reset room queue
            await pool.request()
                .input('room_id', sql.VarChar, roomId)
                .query('UPDATE examination_rooms SET current_queue = 0 WHERE id = @room_id');

            res.json({
                success: true,
                data: {
                    next_queue_number: 0
                },
                message: 'No more patients waiting'
            });
        }
    } catch (error) {
        console.error('Error calling next patient:', error);
        res.status(500).json({
            error: 'Failed to call next patient',
            message: error.message
        });
    }
});

// Get queue statistics by room
router.get('/room/:roomId/stats', async (req, res) => {
    try {
        const pool = await getPool();
        const { roomId } = req.params;

        const result = await pool.request()
            .input('room_id', sql.VarChar, roomId)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT 
                    COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_count,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_today,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_today,
                    MIN(CASE WHEN status = 'waiting' THEN arrival_time END) as oldest_waiting_time,
                    AVG(CASE WHEN status = 'completed' AND completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, called_time, completed_time) END) as avg_service_time_minutes
                FROM patient_queues
                WHERE room_id = @room_id
                AND CAST(arrival_time AS DATE) = @today
            `);

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error fetching queue statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch queue statistics',
            message: error.message
        });
    }
});

module.exports = router;
