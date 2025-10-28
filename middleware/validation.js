const Joi = require('joi');

// Validation schemas
const schemas = {
    // Room validation schemas
    createRoom: Joi.object({
        room_number: Joi.string().max(10).required(),
        room_name: Joi.string().max(100).required(),
        department: Joi.string().max(100).required(),
        floor: Joi.string().max(10).required(),
        capacity: Joi.number().integer().min(1).max(100).default(20),
        status: Joi.string().valid('active', 'inactive').default('active'),
        doctor_id: Joi.string().max(50).allow(null, '')
    }),

    updateRoom: Joi.object({
        room_name: Joi.string().max(100),
        department: Joi.string().max(100),
        floor: Joi.string().max(10),
        capacity: Joi.number().integer().min(1).max(100),
        status: Joi.string().valid('active', 'inactive'),
        doctor_id: Joi.string().max(50).allow(null, ''),
        current_queue: Joi.number().integer().min(0)
    }),

    // Queue validation schemas
    addPatientToQueue: Joi.object({
        hn: Joi.string().max(20).required(),
        patient_name: Joi.string().max(200).required(),
        room_id: Joi.string().max(200).required(),
        department: Joi.string().max(100).required(),
        priority_level: Joi.string().valid('normal', 'urgent', 'emergency').default('normal'),
        pdate: Joi.string().max(8).default(''),
        ptime: Joi.string().max(8).default(''),
        status: Joi.string().valid('waiting', 'active', 'completed', 'cancelled').required()
    }),

    updateQueueStatus: Joi.object({
        status: Joi.string().valid('waiting', 'active', 'completed', 'cancelled').required(),
        performed_by: Joi.string().max(50).required()
    }),

    callNextPatient: Joi.object({
        performed_by: Joi.string().max(50).required()
    }),

    // History validation schemas
    createHistoryEntry: Joi.object({
        patient_queue_id: Joi.number().integer().positive().required(),
        action: Joi.string().valid('created', 'called', 'completed', 'cancelled', 'transferred').required(),
        from_room_id: Joi.string().max(200).allow(null, ''),
        to_room_id: Joi.string().max(200).allow(null, ''),
        performed_by: Joi.string().max(50).required(),
        notes: Joi.string().max(500).allow(null, '')
    }),

    // Department settings validation schemas
    createDepartmentSetting: Joi.object({
        department_name: Joi.string().max(100).required(),
        display_name: Joi.string().max(150).required(),
        max_queue_per_room: Joi.number().integer().min(1).max(1000).default(50),
        auto_call_enabled: Joi.boolean().default(true),
        call_interval_minutes: Joi.number().integer().min(1).max(60).default(5),
        is_active: Joi.boolean().default(true)
    }),

    updateDepartmentSetting: Joi.object({
        display_name: Joi.string().max(150),
        max_queue_per_room: Joi.number().integer().min(1).max(1000),
        auto_call_enabled: Joi.boolean(),
        call_interval_minutes: Joi.number().integer().min(1).max(60),
        is_active: Joi.boolean()
    })
};

// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessages = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                details: errorMessages
            });
        }

        req.body = value;
        next();
    };
};

// Query parameter validation
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessages = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Query validation failed',
                details: errorMessages
            });
        }

        req.query = value;
        next();
    };
};

// Common query schemas
const querySchemas = {
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sort: Joi.string().valid('asc', 'desc').default('asc'),
        sortBy: Joi.string().max(50).default('id')
    }),

    dateRange: Joi.object({
        start_date: Joi.date().iso(),
        end_date: Joi.date().iso().min(Joi.ref('start_date'))
    }),

    roomFilter: Joi.object({
        department: Joi.string().max(100),
        floor: Joi.string().max(10),
        status: Joi.string().valid('active', 'inactive')
    }),

    queueFilter: Joi.object({
        room_id: Joi.string().max(200),
        department: Joi.string().max(100),
        status: Joi.string().valid('waiting', 'active', 'completed', 'cancelled'),
        priority_level: Joi.string().valid('normal', 'urgent', 'emergency'),
        date: Joi.date().iso()
    })
};

module.exports = {
    schemas,
    validate,
    validateQuery,
    querySchemas
};
