const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
require('dotenv').config();

const { testConnection, closePool } = require('./config/database');

// Import routes
const roomRoutes = require('./routes/rooms');
const queueRoutes = require('./routes/queues');
const kioskRoutes = require('./routes/kiosk');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/rooms`, roomRoutes);
app.use(`/api/${API_VERSION}/queues`, queueRoutes);
app.use(`/api/${API_VERSION}/kiosk`, kioskRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Doctor Desk Navigation System API',
        version: API_VERSION,
        endpoints: {
            rooms: `/api/${API_VERSION}/rooms`,
            queues: `/api/${API_VERSION}/queues`,
            kiosk: `/api/${API_VERSION}/kiosk`,
            dashboard: `/api/${API_VERSION}/dashboard`,
            health: '/health',
            docs: '/api-docs'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The endpoint ${req.originalUrl} does not exist`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Database connection errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({
            error: 'Database connection failed',
            message: 'Unable to connect to the database'
        });
    }
    
    // SQL errors
    if (err.number) {
        return res.status(400).json({
            error: 'Database error',
            message: err.message,
            code: err.number
        });
    }
    
    // Default error
    res.status(err.status || 500).json({
        error: 'Internal server error',
        message: err.message || 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Graceful shutdown...');
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    await closePool();
    process.exit(0);
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`API Version: ${API_VERSION}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Swagger UI is available at http://localhost:${PORT}/api-docs`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
