-- Database setup script for Doctor Desk Navigation System
-- Run this script to create the necessary tables in QNurseDB

USE QNurse;
GO

-- Create examinfo table (ห้องตรวจแพทย์)



-- Create patient_queues table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='patient_queues' AND xtype='U')
BEGIN
    CREATE TABLE patient_queues (
        id INT IDENTITY(1,1) PRIMARY KEY,
        hn NVARCHAR(20) NOT NULL,
        patient_name NVARCHAR(200) NOT NULL,
        room_id INT,
        queue_number INT,
        status NVARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'queued', 'completed', 'cancelled')),
        department NVARCHAR(100) NOT NULL,
        arrival_time VARCHAR(12) DEFAULT (
            CONVERT(CHAR(8), GETDATE(), 112) +
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        ),
        called_time VARCHAR(12) NULL,
        completed_time VARCHAR(12) NULL,
        priority_level NVARCHAR(20) DEFAULT 'normal' CHECK (priority_level IN ('normal', 'urgent', 'emergency'))


    );

    -- Create indexes
    CREATE INDEX idx_hn ON patient_queues (hn);
    CREATE INDEX idx_department ON patient_queues (department);
    CREATE INDEX idx_status ON patient_queues (status);
    CREATE INDEX idx_queue_number ON patient_queues (queue_number);
    CREATE INDEX idx_arrival_time ON patient_queues (arrival_time);
    CREATE INDEX idx_room_id ON patient_queues (room_id);
END
GO

-- Create queue_history table for audit trail
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='queue_history' AND xtype='U')
BEGIN
    CREATE TABLE queue_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        patient_queue_id INT NOT NULL,
        action NVARCHAR(20) NOT NULL CHECK (action IN ('created', 'called', 'completed', 'cancelled', 'transferred')),
        from_room_id INT NULL,
        to_room_id INT NULL,
        performed_by NVARCHAR(50) NOT NULL,
        action_time VARCHAR(12) DEFAULT (
            CONVERT(CHAR(8), GETDATE(), 112) +
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        ),
        notes NVARCHAR(MAX) NULL,

    );

    -- Create indexes
    CREATE INDEX idx_patient_queue_id ON queue_history (patient_queue_id);
    CREATE INDEX idx_action_time ON queue_history (action_time);
    CREATE INDEX idx_performed_by ON queue_history (performed_by);
END
GO

-- Create department_settings table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='department_settings' AND xtype='U')
BEGIN
    CREATE TABLE department_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        department_name NVARCHAR(100) NOT NULL UNIQUE,
        display_name NVARCHAR(150) NOT NULL,
        max_queue_per_room INT DEFAULT 50,
        auto_call_enabled BIT DEFAULT 1,
        call_interval_minutes INT DEFAULT 5,
        is_active BIT DEFAULT 1,
        created_at VARCHAR(12) DEFAULT (
            CONVERT(CHAR(8), GETDATE(), 112) +
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        ),
        updated_at VARCHAR(12) DEFAULT (
            CONVERT(CHAR(8), GETDATE(), 112) +
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        )
    );

    -- Create indexes
    CREATE INDEX idx_department_name ON department_settings (department_name);
    CREATE INDEX idx_is_active ON department_settings (is_active);
END
GO

-- Insert sample examination rooms





PRINT 'Database setup completed successfully!';
PRINT 'Tables created: examinfo, patient_queues, queue_history, department_settings';
PRINT 'Stored procedures created: AddPatientToQueue, CallNextPatient';
PRINT 'Views created: active_room_queues, department_stats';
PRINT 'Triggers created: examinfo, tr_department_settings_update';
PRINT 'Sample data inserted for examination rooms and department settings';
