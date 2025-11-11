const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validate, validateQuery, schemas, querySchemas } = require('../middleware/validation');

// Add patient to queue
const addPatientToQueueHandler = async (req, res) => {
    try {
        const pool = await getPool();
        const { hn, patient_name, room_id, department, priority_level, pdate, ptime, status } = req.body;

        // Check if room exists and is active
        const room = await pool.request()
            .input('room_id', sql.VarChar, room_id)
            .query(`
                SELECT id, room_number, status, current_queue 
                FROM examination_rooms 
                WHERE id = @room_id AND status = 'active'
            `);

        if (room.recordset.length === 0) {
            return res.status(404).json({
                error: 'Room not found or inactive',
                message: `No active room found with ID ${room_id}`
            });
        }

        console.log('Status received:', status, 'Type:', typeof status);
        
        switch (status) {
            case 'FIN':
                // Update existing patient queue to completed status
                const result = await pool.request()
                    .input('hn', sql.NVarChar, hn)
                    .input('department', sql.NVarChar, department)
                    .query(`
                        UPDATE patient_queues 
                        SET status = 'FIN', completed_time = CONVERT(CHAR(8), GETDATE(), 112) + RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) + RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
                        WHERE hn = @hn AND department = @department AND status = 'IN'
                        SELECT @@ROWCOUNT as affected_rows
                    `);

                if (result.recordset[0].affected_rows > 0) {
                    // Log the action
                    // await pool.request()
                    //     .input('hn', sql.NVarChar, hn)
                    //     .input('department', sql.NVarChar, department)
                    //     .input('action', sql.NVarChar, 'completed')
                    //     .input('to_room_id', sql.Int, room_id)
                    //     .input('performed_by', sql.NVarChar, 'SYSTEM')
                    //     .input('notes', sql.NVarChar, `Patient queue completed`)
                    //     .query(`
                    //         INSERT INTO queue_history 
                    //         (patient_queue_id, action, to_room_id, performed_by, notes)
                    //         SELECT pq.id, @action, @to_room_id, @performed_by, @notes
                    //         FROM patient_queues pq
                    //         WHERE pq.hn = @hn AND pq.department = @department
                    //     `);

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
                break;

            case 'CALL':
                // Call patient logic (to be implemented based on FIN pattern)
                const callResult = await pool.request()
                    .input('hn', sql.NVarChar, hn)
                    .input('department', sql.NVarChar, department)
                    .query(`
                        UPDATE patient_queues 
                        SET status = 'CALL', called_time = CONVERT(CHAR(8), GETDATE(), 112) + RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) + RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
                        WHERE hn = @hn AND department = @department AND status not in ('','FIN','IN')
                        SELECT @@ROWCOUNT as affected_rows
                    `);

                if (callResult.recordset[0].affected_rows > 0) {
                    // await pool.request()
                    //     .input('hn', sql.NVarChar, hn)
                    //     .input('department', sql.NVarChar, department)
                    //     .input('action', sql.NVarChar, 'called')
                    //     .input('to_room_id', sql.Int, room_id)
                    //     .input('performed_by', sql.NVarChar, 'SYSTEM')
                    //     .input('notes', sql.NVarChar, `Patient called`)
                    //     .query(`
                    //         INSERT INTO queue_history 
                    //         (patient_queue_id, action, to_room_id, performed_by, notes)
                    //         SELECT pq.id, @action, @to_room_id, @performed_by, @notes
                    //         FROM patient_queues pq
                    //         WHERE pq.hn = @hn AND pq.department = @department
                    //     `);

                    res.status(200).json({
                        success: true,
                        message: `Patient called successfully`
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        message: `No waiting patient queue found for HN: ${hn} in department: ${department}`
                    });
                }
                break;

            case 'IN':
                // Patient in room logic (to be implemented based on FIN pattern)
                const inResult = await pool.request()
                    .input('hn', sql.NVarChar, hn)
                    .input('department', sql.NVarChar, department)
                    .query(`
                        UPDATE patient_queues 
                        SET status = 'IN'
                        WHERE hn = @hn AND department = @department AND status IN ('ADD', 'CALL')
                        SELECT @@ROWCOUNT as affected_rows
                    `);

                if (inResult.recordset[0].affected_rows > 0) {
                    // await pool.request()
                    //     .input('hn', sql.NVarChar, hn)
                    //     .input('department', sql.NVarChar, department)
                    //     .input('action', sql.NVarChar, 'in')
                    //     .input('to_room_id', sql.Int, room_id)
                    //     .input('performed_by', sql.NVarChar, 'SYSTEM')
                    //     .input('notes', sql.NVarChar, `Patient entered room`)
                    //     .query(`
                    //         INSERT INTO queue_history 
                    //         (patient_queue_id, action, to_room_id, performed_by, notes)
                    //         SELECT pq.id, @action, @to_room_id, @performed_by, @notes
                    //         FROM patient_queues pq
                    //         WHERE pq.hn = @hn AND pq.department = @department
                    //     `);

                    res.status(200).json({
                        success: true,
                        message: `Patient entered room successfully`
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        message: `No patient queue found for HN: ${hn} in department: ${department}`
                    });
                }
                break;

            case 'SKIP':
                // Skip patient logic (to be implemented based on FIN pattern)
                const skipResult = await pool.request()
                    .input('hn', sql.NVarChar, hn)
                    .input('department', sql.NVarChar, department)
                    .query(`
                        UPDATE patient_queues 
                        SET status = 'skipped', completed_time = CONVERT(CHAR(8), GETDATE(), 112) + RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) + RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
                        WHERE hn = @hn AND department = @department AND status = 'active'
                        SELECT @@ROWCOUNT as affected_rows
                    `);

                if (skipResult.recordset[0].affected_rows > 0) {
                    // await pool.request()
                    //     .input('hn', sql.NVarChar, hn)
                    //     .input('department', sql.NVarChar, department)
                    //     .input('action', sql.NVarChar, 'skipped')
                    //     .input('to_room_id', sql.Int, room_id)
                    //     .input('performed_by', sql.NVarChar, 'SYSTEM')
                    //     .input('notes', sql.NVarChar, `Patient skipped`)
                    //     .query(`
                    //         INSERT INTO queue_history 
                    //         (patient_queue_id, action, to_room_id, performed_by, notes)
                    //         SELECT pq.id, @action, @to_room_id, @performed_by, @notes
                    //         FROM patient_queues pq
                    //         WHERE pq.hn = @hn AND pq.department = @department
                    //     `);

                    res.status(200).json({
                        success: true,
                        message: `Patient skipped successfully`
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        message: `No active patient queue found for HN: ${hn} in department: ${department}`
                    });
                }
                break;

            case 'ADD':
            default:
                // Only for ADD: Check if patient is already in queue for today
                const todayDate = new Date().toISOString().split('T')[0];
                const existingQueue = await pool.request()
                    .input('hn', sql.NVarChar, hn)
                    .input('today', sql.Date, todayDate)
                    .query(`
                        SELECT id, status, room_id 
                        FROM patient_queues 
                        WHERE hn = @hn 
                        AND arrival_time IS NOT NULL
                        AND LEN(arrival_time) >= 8
                        AND CAST(SUBSTRING(arrival_time, 1, 8) AS DATE) = @today
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
                    .input('room_id', sql.Int, room_id)
                    .input('today', sql.Date, todayDate)
                    .query(`
                        SELECT ISNULL(MAX(queue_number), 0) + 1 as next_queue_number
                        FROM patient_queues
                        WHERE room_id = @room_id
                        AND arrival_time IS NOT NULL
                        AND LEN(arrival_time) >= 8
                        AND CAST(SUBSTRING(arrival_time, 1, 8) AS DATE) = @today
                        AND status != 'cancelled'
                    `);

                const nextQueueNumber = nextQueueResult.recordset[0].next_queue_number;

                // Insert patient into queue
                const addResult = await pool.request()
                    .input('hn', sql.NVarChar, hn)
                    .input('patient_name', sql.NVarChar, patient_name)
                    .input('room_id', sql.Int, room_id)
                    .input('queue_number', sql.Int, nextQueueNumber)
                    .input('department', sql.NVarChar, department)
                    .input('priority_level', sql.NVarChar, priority_level)
                    .input('arrival_time', sql.VarChar, `${pdate}${ptime}`)
                    .input('called_time', sql.VarChar, new Date().toISOString().replace(/[-:T]/g, '').substring(0, 12))
                    .query(`
                        INSERT INTO patient_queues 
                        (hn, patient_name, room_id, queue_number, department, priority_level, status, arrival_time, called_time)
                        OUTPUT INSERTED.*
                        VALUES (@hn, @patient_name, @room_id, @queue_number, @department, @priority_level, 'ADD', @arrival_time, @called_time)
                    `);

                // Update room's current queue if this is the first patient
                if (room.recordset[0].current_queue === 0) {
                    await pool.request()
                        .input('room_id', sql.VarChar, room_id)
                        .input('current_queue', sql.Int, nextQueueNumber)
                        .query('UPDATE examination_rooms SET current_queue = @current_queue WHERE room_number = @room_id');
                }

                // Log the action
                // await pool.request()
                //     .input('patient_queue_id', sql.Int, addResult.recordset[0].id)
                //     .input('action', sql.NVarChar, 'created')
                //     .input('to_room_id', sql.Int, room_id)
                //     .input('performed_by', sql.NVarChar, 'SYSTEM')
                //     .input('notes', sql.NVarChar, `Patient added to queue #${nextQueueNumber}`)
                //     .query(`
                //         INSERT INTO queue_history 
                //         (patient_queue_id, action, to_room_id, performed_by, notes)
                //         VALUES (@patient_queue_id, @action, @to_room_id, @performed_by, @notes)
                //     `);

                res.status(201).json({
                    success: true,
                    data: addResult.recordset[0],
                    queue_number: nextQueueNumber,
                    message: `Patient added to queue #${nextQueueNumber}`
                });
                break;
        }
    } catch (error) {
        console.error('Error adding patient to queue2:', error);
        res.status(500).json({
            error: 'Failed to add patient to queue3',
            message: error.message
        });
    }
};

// Backward-compatible endpoint
// router.post('/', validate(schemas.addPatientToQueue), addPatientToQueueHandler);
// Clearer, explicit endpoint name
router.post('/EnterQueue', validate(schemas.addPatientToQueue), addPatientToQueueHandler);


module.exports = router;
