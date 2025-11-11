const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validate, validateQuery, schemas, querySchemas } = require('../middleware/validation');
const { query } = require('mssql');

// Get doctor list - MUST be before /:id route
router.get('/DoctorList', async (req, res) => {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .query(`
                SELECT * From V_DocInf
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'No doctor found.',
                message: `No doctor found from view`
            });
        }

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error DoctorList:', error);
        res.status(500).json({
            error: 'Failed to fetch DoctorList',
            message: error.message
        });
    }
});

// Get doctor list - MUST be before /:id route
router.post('/DoctorAssign', async (req, res) => {
    try {
        const pool = await getPool();
        const { id, doctor_id } = req.body;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('doctor_id', sql.NVarChar, doctor_id)
            .query(`
                UPDATE examination_rooms 
                SET doctor_id = @doctor_id 
                WHERE id = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                error: 'Room not found',
                message: `No room found with ID ${id}`
            });
        }

        res.json({
            success: true,
            message: 'Doctor assigned successfully'
        });
    } catch (error) {
        console.error('Error DoctorAssign:', error);
        res.status(500).json({
            error: 'Failed to update doctor room',
            message: error.message
        });
    }
});

// Get all examination rooms
router.get('/examinationlist', validateQuery(querySchemas.roomFilter), async (req, res) => {
    try {
        const pool = await getPool();
        const { station } = req.query;

        let query = `
            SELECT id, exam_room, room_name, status, current_queue, doctor_id, created_at, updated_at
            FROM examinfo
            WHERE 1=1
        `;
        
        const params = [];
        
        if (station) {
            query += ` AND station_code = @station`;
            params.push({ name: 'station', value: station });
        }
        
        
        query += ` ORDER BY station_code, exam_room`;

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


// Get all stations
router.get('/stationlist', async (req, res) => {
    try {
        const pool = await getPool();

        const result = await pool.request()
            .query(`
                SELECT *
                FROM V_station
                ORDER BY seq
            `);
        
        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length
        });
    } catch (error) {
        console.error('Error fetching stationlist:', error);
        res.status(500).json({
            error: 'Failed to fetch stationlist',
            message: error.message
        });
    }
});

module.exports = router;
