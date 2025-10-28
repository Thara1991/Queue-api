const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validate, validateQuery, schemas, querySchemas } = require('../middleware/validation');

// Get all examination rooms
router.get('/', validateQuery(querySchemas.roomFilter), async (req, res) => {
    try {
        const pool = await getPool();
        const { department, floor, status } = req.query;

        let query = `
            SELECT 
                id, room_number, room_name, department, floor, 
                capacity, status, current_queue, doctor_id,
                created_at, updated_at
            FROM examination_rooms
            WHERE 1=1
        `;
        
        const params = [];
        
        if (department) {
            query += ` AND department = @department`;
            params.push({ name: 'department', value: department });
        }
        
        if (floor) {
            query += ` AND floor = @floor`;
            params.push({ name: 'floor', value: floor });
        }
        
        if (status) {
            query += ` AND status = @status`;
            params.push({ name: 'status', value: status });
        }
        
        query += ` ORDER BY department, room_number`;

        const request = pool.request();
        params.forEach(param => request.input(param.name, sql.VarChar, param.value));
        
        const result = await request.query(query);
        
        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (error) {
        console.error('Error fetching examination rooms:', error);
        res.status(500).json({
            error: 'Failed to fetch examination rooms',
            message: error.message
        });
    }
});

// Get examination room by ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query(`
                SELECT 
                    id, room_number, room_name, department, floor, 
                    capacity, status, current_queue, doctor_id,
                    created_at, updated_at
                FROM examination_rooms
                WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Examination room not found',
                message: `No room found with ID ${id}`
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error fetching examination room:', error);
        res.status(500).json({
            error: 'Failed to fetch examination room',
            message: error.message
        });
    }
});

// Create new examination room
router.post('/', validate(schemas.createRoom), async (req, res) => {
    try {
        const pool = await getPool();
        const { room_number, room_name, department, floor, capacity, status, doctor_id } = req.body;

        // Check if room number already exists
        const existingRoom = await pool.request()
            .input('room_number', sql.VarChar, room_number)
            .query('SELECT id FROM examination_rooms WHERE room_number = @room_number');

        if (existingRoom.recordset.length > 0) {
            return res.status(409).json({
                error: 'Room number already exists',
                message: `Room number ${room_number} is already in use`
            });
        }

        const result = await pool.request()
            .input('room_number', sql.VarChar, room_number)
            .input('room_name', sql.VarChar, room_name)
            .input('department', sql.VarChar, department)
            .input('floor', sql.VarChar, floor)
            .input('capacity', sql.Int, capacity)
            .input('status', sql.VarChar, status)
            .input('doctor_id', sql.VarChar, doctor_id || null)
            .query(`
                INSERT INTO examination_rooms 
                (room_number, room_name, department, floor, capacity, status, doctor_id)
                OUTPUT INSERTED.*
                VALUES (@room_number, @room_name, @department, @floor, @capacity, @status, @doctor_id)
            `);

        res.status(201).json({
            success: true,
            data: result.recordset[0],
            message: 'Examination room created successfully'
        });
    } catch (error) {
        console.error('Error creating examination room:', error);
        res.status(500).json({
            error: 'Failed to create examination room',
            message: error.message
        });
    }
});

// Update examination room
router.put('/:id', validate(schemas.updateRoom), async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;
        const updates = req.body;

        // Check if room exists
        const existingRoom = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT id FROM examination_rooms WHERE id = @id');

        if (existingRoom.recordset.length === 0) {
            return res.status(404).json({
                error: 'Examination room not found',
                message: `No room found with ID ${id}`
            });
        }

        // Build dynamic update query
        const updateFields = [];
        const request = pool.request().input('id', sql.VarChar, id);

        Object.keys(updates).forEach(key => {
            updateFields.push(`${key} = @${key}`);
            request.input(key, sql.VarChar, updates[key]);
        });

        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'No fields to update',
                message: 'Please provide at least one field to update'
            });
        }

        const query = `
            UPDATE examination_rooms 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            OUTPUT INSERTED.*
            WHERE id = @id
        `;

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset[0],
            message: 'Examination room updated successfully'
        });
    } catch (error) {
        console.error('Error updating examination room:', error);
        res.status(500).json({
            error: 'Failed to update examination room',
            message: error.message
        });
    }
});

// Delete examination room
router.delete('/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;

        // Check if room exists
        const existingRoom = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT id, room_number FROM examination_rooms WHERE id = @id');

        if (existingRoom.recordset.length === 0) {
            return res.status(404).json({
                error: 'Examination room not found',
                message: `No room found with ID ${id}`
            });
        }

        // Check if room has active patients
        const activePatients = await pool.request()
            .input('room_id', sql.VarChar, id)
            .query(`
                SELECT COUNT(*) as count 
                FROM patient_queues 
                WHERE room_id = @room_id 
                AND status IN ('waiting', 'active')
                AND CAST(arrival_time AS DATE) = CAST(GETDATE() AS DATE)
            `);

        if (activePatients.recordset[0].count > 0) {
            return res.status(409).json({
                error: 'Cannot delete room with active patients',
                message: 'Please complete or cancel all patient queues before deleting this room'
            });
        }

        await pool.request()
            .input('id', sql.VarChar, id)
            .query('DELETE FROM examination_rooms WHERE id = @id');

        res.json({
            success: true,
            message: `Examination room ${existingRoom.recordset[0].room_number} deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting examination room:', error);
        res.status(500).json({
            error: 'Failed to delete examination room',
            message: error.message
        });
    }
});

// Get room statistics
router.get('/:id/stats', async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;

        const result = await pool.request()
            .input('room_id', sql.VarChar, id)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT 
                    r.id as room_id,
                    r.room_number,
                    r.room_name,
                    r.department,
                    r.current_queue,
                    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_count,
                    COUNT(CASE WHEN pq.status = 'active' THEN 1 END) as active_count,
                    COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_today,
                    COUNT(CASE WHEN pq.status = 'cancelled' THEN 1 END) as cancelled_today,
                    MIN(CASE WHEN pq.status = 'waiting' THEN pq.arrival_time END) as oldest_waiting_time,
                    AVG(CASE WHEN pq.status = 'completed' AND pq.completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.called_time, pq.completed_time) END) as avg_service_time_minutes
                FROM examination_rooms r
                LEFT JOIN patient_queues pq ON r.id = pq.room_id
                    AND CAST(pq.arrival_time AS DATE) = @today
                WHERE r.id = @room_id
                GROUP BY r.id, r.room_number, r.room_name, r.department, r.current_queue
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Examination room not found',
                message: `No room found with ID ${id}`
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error fetching room statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch room statistics',
            message: error.message
        });
    }
});

module.exports = router;
