const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');

router.get('/dashboardlist', async (req, res) => {
    try {
        const pool = await getPool();
        const { date, nursestation } = req.query;
        const request = pool.request();

        request.input('date', sql.VarChar, date);
        let query = ` SELECT 
            E.id as room_id,
            E.queue_caption,
            E.exam_room,
            E.room_name,
            E.status as room_status,
            E.current_queue,
            E.doctor_id,
            E.created_at,
            E.updated_at,
            E.Call_yon,
            E.Called_times,
            ISNULL(P.id, '') as queue_id,
            ISNULL(P.hn, '') as hn,
            ISNULL(P.patient_name, '') as patient_name,
            ISNULL(P.room_id, '') as queue_room_id,
            ISNULL(P.queue_number, 0) as queue_number,
            ISNULL(P.arrival_time, '') as arrival_time,
            ISNULL(P.called_time, '') as called_time,
            ISNULL(P.completed_time, '') as completed_time,
            ISNULL(P.priority_level, '') as priority_level,
            ISNULL(P.status, '') as queue_status,
            UidNam,
            UidEngNam 
            FROM QNurse.dbo.examinfo E 
            LEFT JOIN QNurse.dbo.patient_queues P ON P.room_id = E.id 
                AND P.arrival_time IS NOT NULL 
                AND LEN(P.arrival_time) >= 8
                AND LEFT(P.arrival_time, 8) = @date
                And P.status not in ('FIN','SKIP','CANCEL','ADD')
            LEFT JOIN V_DocInf on UidCod = E.doctor_id
            WHERE ISNULL(E.doctor_id, '') <> '' 
            AND E.status = 'active'
                `;


        // if (nursestation) {
        //     query += ` AND E.department = @nursestation`;
        //     request.input('nursestation', sql.NVarChar, nursestation);
        // }

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching DashboardList:', error);
        res.status(500).json({
            error: 'Failed to fetch DashboardList',
            message: error.message
        });
    }
});

router.get('/callqueue', async (req, res) => {
    try {
        const pool = await getPool();
        const { id, called } = req.query;

        // Validate required parameters
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: id'
            });
        }

        if (!called || (called !== 'Y' && called !== 'N')) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid parameter: called (must be "Y" or "N")'
            });
        }

        const request = pool.request();
        request.input('id', sql.Int, parseInt(id));
        request.input('called', sql.Char(1), called);

        const query = `
            UPDATE QNurse.dbo.examinfo 
            SET Call_Yon = @called, called_times = ISNULL(called_times, 0) + 1
            WHERE id = @id
            SELECT @@ROWCOUNT as affected_rows
        `;

        const result = await request.query(query);

        if (result.recordset[0].affected_rows > 0) {
            res.status(200).json({
                success: true,
                message: `Call status updated to '${called}' for queue id ${id}`
            });
        } else {
            res.status(404).json({
                success: false,
                message: `No queue found with id ${id}`
            });
        }
    } catch (error) {
        console.error('Error call queue on dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update call queue',
            message: error.message
        });
    }
});


module.exports = router;