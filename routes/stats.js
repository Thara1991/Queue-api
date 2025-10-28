const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { validateQuery, querySchemas } = require('../middleware/validation');

// Get overall system statistics
router.get('/overview', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        const params = [];
        
        if (start_date && end_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) BETWEEN @start_date AND @end_date`;
            params.push({ name: 'start_date', value: start_date });
            params.push({ name: 'end_date', value: end_date });
        } else if (start_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) >= @start_date`;
            params.push({ name: 'start_date', value: start_date });
        } else if (end_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) <= @end_date`;
            params.push({ name: 'end_date', value: end_date });
        } else {
            // Default to today
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request()
            .query(`
                SELECT 
                    COUNT(*) as total_patients,
                    COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_patients,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_patients,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_patients,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_patients,
                    COUNT(CASE WHEN priority_level = 'emergency' THEN 1 END) as emergency_patients,
                    COUNT(CASE WHEN priority_level = 'urgent' THEN 1 END) as urgent_patients,
                    COUNT(CASE WHEN priority_level = 'normal' THEN 1 END) as normal_patients,
                    AVG(CASE WHEN status = 'completed' AND completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, arrival_time, completed_time) END) as avg_waiting_time_minutes,
                    AVG(CASE WHEN status = 'completed' AND completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, called_time, completed_time) END) as avg_service_time_minutes
                FROM patient_queues pq
                ${dateFilter}
            `);

        // Get department statistics
        const deptStats = await pool.request()
            .query(`
                SELECT 
                    department,
                    COUNT(*) as total_patients,
                    COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_patients,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_patients,
                    AVG(CASE WHEN status = 'completed' AND completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, arrival_time, completed_time) END) as avg_waiting_time_minutes
                FROM patient_queues pq
                ${dateFilter}
                GROUP BY department
                ORDER BY total_patients DESC
            `);

        res.json({
            success: true,
            data: {
                overview: result.recordset[0],
                department_stats: deptStats.recordset
            }
        });
    } catch (error) {
        console.error('Error fetching overview statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch overview statistics',
            message: error.message
        });
    }
});

// Get room performance statistics
router.get('/rooms/performance', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        
        if (start_date && end_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) BETWEEN '${start_date}' AND '${end_date}'`;
        } else if (start_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) >= '${start_date}'`;
        } else if (end_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) <= '${end_date}'`;
        } else {
            // Default to today
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request()
            .query(`
                SELECT 
                    r.id as room_id,
                    r.room_number,
                    r.room_name,
                    r.department,
                    r.floor,
                    COUNT(pq.id) as total_patients,
                    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_patients,
                    COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_patients,
                    AVG(CASE WHEN pq.status = 'completed' AND pq.completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.arrival_time, pq.completed_time) END) as avg_waiting_time_minutes,
                    AVG(CASE WHEN pq.status = 'completed' AND pq.completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.called_time, pq.completed_time) END) as avg_service_time_minutes,
                    MIN(CASE WHEN pq.status = 'waiting' THEN pq.arrival_time END) as oldest_waiting_time
                FROM examination_rooms r
                LEFT JOIN patient_queues pq ON r.id = pq.room_id
                ${dateFilter}
                GROUP BY r.id, r.room_number, r.room_name, r.department, r.floor
                ORDER BY r.department, r.room_number
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching room performance statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch room performance statistics',
            message: error.message
        });
    }
});

// Get hourly statistics
router.get('/hourly', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        
        if (start_date && end_date) {
            dateFilter = `WHERE CAST(arrival_time AS DATE) BETWEEN '${start_date}' AND '${end_date}'`;
        } else if (start_date) {
            dateFilter = `WHERE CAST(arrival_time AS DATE) >= '${start_date}'`;
        } else if (end_date) {
            dateFilter = `WHERE CAST(arrival_time AS DATE) <= '${end_date}'`;
        } else {
            // Default to today
            dateFilter = `WHERE CAST(arrival_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request()
            .query(`
                SELECT 
                    DATEPART(HOUR, arrival_time) as hour,
                    COUNT(*) as total_patients,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_patients,
                    COUNT(CASE WHEN priority_level = 'emergency' THEN 1 END) as emergency_patients,
                    COUNT(CASE WHEN priority_level = 'urgent' THEN 1 END) as urgent_patients,
                    AVG(CASE WHEN status = 'completed' AND completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, arrival_time, completed_time) END) as avg_waiting_time_minutes
                FROM patient_queues
                ${dateFilter}
                GROUP BY DATEPART(HOUR, arrival_time)
                ORDER BY hour
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching hourly statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch hourly statistics',
            message: error.message
        });
    }
});

// Get waiting time analysis
router.get('/waiting-times', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        
        if (start_date && end_date) {
            dateFilter = `WHERE CAST(arrival_time AS DATE) BETWEEN '${start_date}' AND '${end_date}'`;
        } else if (start_date) {
            dateFilter = `WHERE CAST(arrival_time AS DATE) >= '${start_date}'`;
        } else if (end_date) {
            dateFilter = `WHERE CAST(arrival_time AS DATE) <= '${end_date}'`;
        } else {
            // Default to today
            dateFilter = `WHERE CAST(arrival_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request()
            .query(`
                SELECT 
                    department,
                    priority_level,
                    AVG(DATEDIFF(MINUTE, arrival_time, completed_time)) as avg_waiting_time_minutes,
                    MIN(DATEDIFF(MINUTE, arrival_time, completed_time)) as min_waiting_time_minutes,
                    MAX(DATEDIFF(MINUTE, arrival_time, completed_time)) as max_waiting_time_minutes,
                    COUNT(*) as patient_count
                FROM patient_queues
                ${dateFilter}
                AND status = 'completed'
                AND completed_time IS NOT NULL
                GROUP BY department, priority_level
                ORDER BY department, 
                    CASE priority_level
                        WHEN 'emergency' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'normal' THEN 3
                    END
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching waiting time analysis:', error);
        res.status(500).json({
            error: 'Failed to fetch waiting time analysis',
            message: error.message
        });
    }
});

// Get department comparison
router.get('/departments/compare', validateQuery(querySchemas.dateRange), async (req, res) => {
    try {
        const pool = await getPool();
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        
        if (start_date && end_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) BETWEEN '${start_date}' AND '${end_date}'`;
        } else if (start_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) >= '${start_date}'`;
        } else if (end_date) {
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) <= '${end_date}'`;
        } else {
            // Default to today
            dateFilter = `WHERE CAST(pq.arrival_time AS DATE) = CAST(GETDATE() AS DATE)`;
        }

        const result = await pool.request()
            .query(`
                SELECT 
                    pq.department,
                    COUNT(DISTINCT r.id) as total_rooms,
                    COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rooms,
                    COUNT(pq.id) as total_patients,
                    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_patients,
                    COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_patients,
                    AVG(CASE WHEN pq.status = 'completed' AND pq.completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.arrival_time, pq.completed_time) END) as avg_waiting_time_minutes,
                    AVG(CASE WHEN pq.status = 'completed' AND pq.completed_time IS NOT NULL 
                        THEN DATEDIFF(MINUTE, pq.called_time, pq.completed_time) END) as avg_service_time_minutes,
                    COUNT(pq.id) / COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as patients_per_room
                FROM patient_queues pq
                LEFT JOIN examination_rooms r ON pq.department = r.department
                ${dateFilter}
                GROUP BY pq.department
                ORDER BY total_patients DESC
            `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching department comparison:', error);
        res.status(500).json({
            error: 'Failed to fetch department comparison',
            message: error.message
        });
    }
});

module.exports = router;
