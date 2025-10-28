const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');

router.get('/getPatientList', async (req, res) => {
    try {
        const pool = await getPool();
        const { ChtNum, AcpDte } = req.params;

        const result = await pool.request()
            .input('ChtNum', sql.VarChar, ChtNum)
            .input('AcpDte', sql.VarChar, AcpDte)
            .query(`
                SELECT OcmNum id, OcmVstNum queueNumber, PbsPatNam + ' ' + PbsSurNam name, IsNull(RomCod, '') room, '' roomName, Left(OcmAcpDtm, 8) date, station = IsNull(DtlCodNam, ''), status = 'waiting', Right(OcmAcpDtm, 4) time
                FROM v_OcmInf Left Join patient_queues On ChtNum = OcmChtNum
                    Left Join BITHIS..DtlMst On DtlTblCOd = 'NRSSTN' And Dtlcod = OcmNrsStn
                WHERE Left(OcmAcpDtm, 8) = '20251008'
                And OcmVstNum <> ''
                And OcmPatTyp = 'O'
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

module.exports = router;