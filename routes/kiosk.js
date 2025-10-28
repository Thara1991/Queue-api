const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validate, schemas } = require('../middleware/validation');

router.get('/getPatientList', async (req, res) => {
    try {
        const pool = await getPool();
        const { ChtNum, AcpDte } = req.params;

        const result = await pool.request()
            .input('ChtNum', sql.VarChar, ChtNum)
            .input('AcpDte', sql.VarChar, AcpDte)
            .query(`
                 select  id,  hn, queue_Number queueNumber,  patient_name, 
                         IsNull(room_id, '') room,
                        '' roomName, left(arrival_time,8)  pdate, station = '', 
                        status, Right(arrival_time, 4) ptime, department 
                from patient_queues
                union 
				SELECT OcmNum id, OcmChtNum hn,
                         OcmVstNum queueNumber, PbsPatNam + ' ' + PbsSurNam patient_name, 
                         '' room,
                        '' roomName, Left(OcmAcpDtm, 8) pdate, station = IsNull(DtlCodNam, ''), 
                        status = 'waiting', Right(OcmAcpDtm, 4) ptime, OcmDepCod department
                FROM v_OcmInf --Left Join patient_queues On hn = OcmChtNum
                    Left Join BITHIS..DtlMst On DtlTblCOd = 'NRSSTN' And Dtlcod = OcmNrsStn
                WHERE Left(OcmAcpDtm, 8) = '20251008' And OcmChtnum not in (Select hn From patient_queues  )
                And OcmVstNum <> ''
                And OcmPatTyp = 'O'
                order by queue_number
            `);

            // .query(`
            //     SELECT OcmNum id, OcmChtNum hn,
            //              OcmVstNum queueNumber, PbsPatNam + ' ' + PbsSurNam patient_name, 
            //              IsNull(room_id, '') room,
            //             '' roomName, Left(OcmAcpDtm, 8) pdate, station = IsNull(DtlCodNam, ''), 
            //             status = 'waiting', Right(OcmAcpDtm, 4) ptime, OcmDepCod department
            //     FROM v_OcmInf Left Join patient_queues On hn = OcmChtNum
            //         Left Join BITHIS..DtlMst On DtlTblCOd = 'NRSSTN' And Dtlcod = OcmNrsStn
            //     WHERE Left(OcmAcpDtm, 8) = '20251008'
            //     And OcmVstNum <> ''
            //     And OcmPatTyp = 'O'
            // `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching departments for kiosk:', error);
        res.status(500).json({
            error: 'Failed to fetch departments',
            message: error.message
        });
    }
});


// Get all departments for kiosk selection
router.get('/departments', async (req, res) => {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .query(`
                SELECT 
                    ds.department_name,
                    ds.display_name,
                    COUNT(DISTINCT r.id) as total_rooms,
                    COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rooms,
                    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_patients,
                    AVG(CASE WHEN pq.status = 'waiting' THEN
                        DATEDIFF(MINUTE, pq.arrival_time, GETDATE())
                    END) as avg_waiting_minutes
                FROM department_settings ds
                LEFT JOIN examination_rooms r ON ds.department_name = r.department
                LEFT JOIN patient_queues pq ON r.id = pq.room_id
                    AND CAST(pq.arrival_time AS DATE) = CAST(GETDATE() AS DATE)
                    AND pq.status = 'waiting'
                WHERE ds.is_active = 1
                GROUP BY ds.department_name, ds.display_name
                ORDER BY ds.display_name
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching departments for kiosk:', error);
        res.status(500).json({
            error: 'Failed to fetch departments',
            message: error.message
        });
    }
});

// Get available rooms for a department
router.get('/departments/:department/rooms', async (req, res) => {
    try {
        const pool = await getPool();
        const { department } = req.params;

        const result = await pool.request()
            .input('department', sql.VarChar, department)
            .query(`
                SELECT 
                    id, room_number, room_name, floor,
                    current_queue,
                    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_count,
                    MIN(CASE WHEN pq.status = 'waiting' THEN pq.arrival_time END) as oldest_waiting_time
                FROM examination_rooms r
                LEFT JOIN patient_queues pq ON r.id = pq.room_id
                    AND CAST(pq.arrival_time AS DATE) = CAST(GETDATE() AS DATE)
                    AND pq.status = 'waiting'
                WHERE r.department = @department AND r.status = 'active'
                GROUP BY r.id, r.room_number, r.room_name, r.floor, r.current_queue
                ORDER BY r.room_number
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching rooms for department:', error);
        res.status(500).json({
            error: 'Failed to fetch rooms',
            message: error.message
        });
    }
});

// Get estimated waiting time for a room
router.get('/rooms/:roomId/waiting-time', async (req, res) => {
    try {
        const pool = await getPool();
        const { roomId } = req.params;

        const result = await pool.request()
            .input('room_id', sql.VarChar, roomId)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT 
                    r.room_number,
                    r.room_name,
                    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_count,
                    AVG(CASE WHEN pq.status = 'completed' AND pq.completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.called_time, pq.completed_time) END) as avg_service_time_minutes,
                    MIN(CASE WHEN pq.status = 'waiting' THEN pq.arrival_time END) as oldest_waiting_time
                FROM examination_rooms r
                LEFT JOIN patient_queues pq ON r.id = pq.room_id
                    AND CAST(pq.arrival_time AS DATE) = @today
                    AND pq.status IN ('waiting', 'completed')
                WHERE r.id = @room_id
                GROUP BY r.id, r.room_number, r.room_name
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Room not found',
                message: `No room found with ID ${roomId}`
            });
        }

        const roomData = result.recordset[0];
        const waitingCount = roomData.waiting_count || 0;
        const avgServiceTime = roomData.avg_service_time_minutes || 15; // Default 15 minutes if no data
        const estimatedWaitingTime = waitingCount * avgServiceTime;

        res.json({
            success: true,
            data: {
                room_number: roomData.room_number,
                room_name: roomData.room_name,
                waiting_count: waitingCount,
                estimated_waiting_minutes: estimatedWaitingTime,
                estimated_waiting_time: `${Math.ceil(estimatedWaitingTime)} นาที`,
                avg_service_time_minutes: avgServiceTime
            }
        });
    } catch (error) {
        console.error('Error calculating waiting time:', error);
        res.status(500).json({
            error: 'Failed to calculate waiting time',
            message: error.message
        });
    }
});

// Quick add patient to queue (simplified for kiosk)
router.post('/add-to-queue', validate(schemas.addPatientToQueue), async (req, res) => {
    try {
        const pool = await getPool();
        const { hn, patient_name, room_id, department, priority_level } = req.body;

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

        // Insert patient into queue
        const result = await pool.request()
            .input('hn', sql.VarChar, hn)
            .input('patient_name', sql.VarChar, patient_name)
            .input('room_id', sql.VarChar, room_id)
            .input('queue_number', sql.Int, nextQueueNumber)
            .input('department', sql.VarChar, department)
            .input('priority_level', sql.VarChar, priority_level)
            .query(`
                INSERT INTO patient_queues 
                (hn, patient_name, room_id, queue_number, department, priority_level, status)
                OUTPUT INSERTED.*
                VALUES (@hn, @patient_name, @room_id, @queue_number, @department, @priority_level, 'waiting')
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
            .input('performed_by', sql.VarChar, 'KIOSK')
            .input('notes', sql.VarChar, `Patient added to queue #${nextQueueNumber} via kiosk`)
            .query(`
                INSERT INTO queue_history 
                (patient_queue_id, action, to_room_id, performed_by, notes)
                VALUES (@patient_queue_id, @action, @to_room_id, @performed_by, @notes)
            `);

        res.status(201).json({
            success: true,
            data: {
                queue_id: result.recordset[0].id,
                queue_number: nextQueueNumber,
                room_number: room.recordset[0].room_number,
                estimated_waiting_time: 'กำลังคำนวณ...',
                message: `ลงทะเบียนคิวสำเร็จ หมายเลขคิว: ${nextQueueNumber}`
            }
        });
    } catch (error) {
        console.error('Error adding patient to queue via kiosk:', error);
        res.status(500).json({
            error: 'Failed to add patient to queue1',
            message: error.message
        });
    }
});

// Get current queue status for display
router.get('/queue-status/:queueId', async (req, res) => {
    try {
        const pool = await getPool();
        const { queueId } = req.params;

        const result = await pool.request()
            .input('queue_id', sql.Int, queueId)
            .query(`
                SELECT 
                    pq.id, pq.hn, pq.patient_name, pq.queue_number, pq.status,
                    pq.arrival_time, pq.called_time,
                    r.room_number, r.room_name, r.department,
                    CASE 
                        WHEN pq.status = 'waiting' THEN 'รอเรียก'
                        WHEN pq.status = 'active' THEN 'กำลังตรวจ'
                        WHEN pq.status = 'completed' THEN 'เสร็จสิ้น'
                        WHEN pq.status = 'cancelled' THEN 'ยกเลิก'
                        ELSE pq.status
                    END as status_thai,
                    DATEDIFF(MINUTE, pq.arrival_time, GETDATE()) as waiting_minutes
                FROM patient_queues pq
                LEFT JOIN examination_rooms r ON pq.room_id = r.id
                WHERE pq.id = @queue_id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Queue not found',
                message: `No queue found with ID ${queueId}`
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error fetching queue status:', error);
        res.status(500).json({
            error: 'Failed to fetch queue status',
            message: error.message
        });
    }
});

// Get queue position for a patient
router.get('/queue-position/:queueId', async (req, res) => {
    try {
        const pool = await getPool();
        const { queueId } = req.params;

        // Get current patient queue info
        const patientQueue = await pool.request()
            .input('queue_id', sql.Int, queueId)
            .query(`
                SELECT pq.id, pq.queue_number, pq.room_id, pq.status, r.room_number
                FROM patient_queues pq
                LEFT JOIN examination_rooms r ON pq.room_id = r.id
                WHERE pq.id = @queue_id
            `);

        if (patientQueue.recordset.length === 0) {
            return res.status(404).json({
                error: 'Queue not found',
                message: `No queue found with ID ${queueId}`
            });
        }

        const patient = patientQueue.recordset[0];
        
        // Count patients ahead in the same room
        const aheadCount = await pool.request()
            .input('room_id', sql.VarChar, patient.room_id)
            .input('queue_number', sql.Int, patient.queue_number)
            .input('today', sql.Date, new Date().toISOString().split('T')[0])
            .query(`
                SELECT COUNT(*) as ahead_count
                FROM patient_queues
                WHERE room_id = @room_id
                AND queue_number < @queue_number
                AND CAST(arrival_time AS DATE) = @today
                AND status IN ('waiting', 'active')
            `);

        const aheadCountValue = aheadCount.recordset[0].ahead_count;

        res.json({
            success: true,
            data: {
                queue_id: patient.id,
                queue_number: patient.queue_number,
                room_number: patient.room_number,
                status: patient.status,
                position: aheadCountValue + 1,
                ahead_count: aheadCountValue,
                message: aheadCountValue === 0 ? 'ถึงคิวของคุณแล้ว' : `มีผู้ป่วยรออยู่ข้างหน้า ${aheadCountValue} คน`
            }
        });
    } catch (error) {
        console.error('Error fetching queue position:', error);
        res.status(500).json({
            error: 'Failed to fetch queue position',
            message: error.message
        });
    }
});

module.exports = router;