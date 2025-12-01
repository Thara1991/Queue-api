const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');

router.get('/getpatientList', async (req, res) => {
    try {
        const pool = await getPool();
        const { AcpDte, station } = req.query;

        const request = pool.request()
            .input('AcpDte', sql.VarChar, AcpDte);

        let query = `
            select  id,  hn, queue_Number queueNumber,  patient_name,
                     IsNull(room_id, 0) room,
                    '' roomName, left(arrival_time,8)  pdate, station = DtlCodNam,
                    status, Right(arrival_time, 4) ptime, department, arrival_time, called_time, exam_time
            from patient_queues Left Join BITHIS..DtlMst On DtlTblCod = 'NRSSTN' And Dtlcod = department
            Where left(arrival_time,8) = @AcpDte
            union
            SELECT OcmNum id, OcmChtNum hn,
                    '0' queueNumber, PbsPatNam + ' ' + PbsSurNam patient_name,
                    0 room,
                    '' roomName, Left(OcmAcpDtm, 8) pdate, station = IsNull(DtlCodNam, ''),
                    status = '', Right(OcmAcpDtm, 4) ptime, OcmNrsStn department, arrival_time = '', called_time = '', exam_time = ''
            FROM v_OcmInf
                Left Join BITHIS..DtlMst On DtlTblCod = 'NRSSTN' And Dtlcod = OcmNrsStn
            WHERE Left(OcmAcpDtm, 8) = @AcpDte And OcmChtnum not in (Select hn From patient_queues)
            And OcmVstNum <> ''
            And OcmPatTyp = 'O'`;

        // Add station filter if provided
        if (station) {
            request.input('station', sql.VarChar, station);
            query += ` And OcmNrsStn = @station`;
        }

        query += ` order by queue_number`;

        const result = await request.query(query);

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

module.exports = router;