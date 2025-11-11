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
            E.exam_room,
            E.room_name,
            E.status as room_status,
            E.current_queue,
            E.doctor_id,
            E.created_at,
            E.updated_at,
            P.id as queue_id,
            P.hn,
            P.patient_name,
            P.room_id as queue_room_id,
            P.queue_number,
            P.arrival_time,
            P.called_time,
            P.completed_time,
            P.priority_level,
            P.status as queue_status,
            UidNam,
            UidEngNam 
            FROM QNurse.dbo.examinfo E 
            LEFT JOIN QNurse.dbo.patient_queues P ON P.room_id = E.id 
                AND P.arrival_time IS NOT NULL 
                AND LEN(P.arrival_time) >= 8
                AND LEFT(P.arrival_time, 8) = @date
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

module.exports = router;