const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'QNurseDB',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise;

const getPool = () => {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config).connect().then(pool => {
            console.log('Connected to MSSQL Database');
            return pool;
        }).catch(err => {
            console.error('Database Connection Failed!', err);
            process.exit(1);
        });
    }
    return poolPromise;
};

const closePool = async () => {
    try {
        const pool = await getPool();
        await pool.close();
        console.log('Database connection closed');
    } catch (err) {
        console.error('Error closing database connection:', err);
    }
};

// Test database connection
const testConnection = async () => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT 1 as test');
        console.log('Database connection test successful');
        return true;
    } catch (err) {
        console.error('Database connection test failed:', err);
        return false;
    }
};

module.exports = {
    sql,
    getPool,
    closePool,
    testConnection,
    config
};
