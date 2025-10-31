-- Database setup script for Doctor Desk Navigation System
-- Run this script to create the necessary tables in QNurseDB

USE QNurseDb;
GO

-- Create examination_rooms table (ห้องตรวจแพทย์)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='examination_rooms' AND xtype='U')
BEGIN
CREATE TABLE examination_rooms (
    id INT IDENTITY(1,1) PRIMARY KEY,
    room_number NVARCHAR(10) NOT NULL UNIQUE,
    room_name NVARCHAR(100) NOT NULL,
    department NVARCHAR(100) NOT NULL,
    floor NVARCHAR(10) NOT NULL,
    capacity INT DEFAULT 20,
    status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    current_queue INT DEFAULT 0,
    doctor_id NVARCHAR(50) NULL,
    created_at VARCHAR(12) 
        DEFAULT (
            CONVERT(CHAR(8), GETDATE(), 112) + 
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        ),
    updated_at VARCHAR(12) 
        DEFAULT (
            CONVERT(CHAR(8), GETDATE(), 112) + 
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        )
);

    -- Create indexes
    CREATE INDEX idx_department ON examination_rooms (department);
    CREATE INDEX idx_status ON examination_rooms (status);
    CREATE INDEX idx_doctor_id ON examination_rooms (doctor_id);
    CREATE INDEX idx_room_number ON examination_rooms (room_number);
END
GO

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

        -- Add foreign key constraint
        CONSTRAINT FK_patient_queues_room_id 
        FOREIGN KEY (room_id) REFERENCES examination_rooms(id) ON DELETE SET NULL
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
INSERT INTO examination_rooms (room_number, room_name, department, floor, capacity, status) VALUES
('101', 'ห้องตรวจ 101', 'อายุรกรรม', '1', 20, 'active'),
('102', 'ห้องตรวจ 102', 'อายุรกรรม', '1', 20, 'active'),
('201', 'ห้องตรวจ 201', 'ศัลยกรรม', '2', 25, 'active'),
('202', 'ห้องตรวจ 202', 'ศัลยกรรม', '2', 25, 'active'),
('301', 'ห้องตรวจ 301', 'กุมารเวช', '3', 15, 'active'),
('302', 'ห้องตรวจ 302', 'กุมารเวช', '3', 15, 'active'),
('401', 'ห้องตรวจ 401', 'สูติกรรม', '4', 18, 'active'),
('402', 'ห้องตรวจ 402', 'สูติกรรม', '4', 18, 'active');
GO

-- Insert sample department settings
INSERT INTO department_settings (department_name, display_name, max_queue_per_room, auto_call_enabled, call_interval_minutes) VALUES
('อายุรกรรม', 'แผนกอายุรกรรม', 50, 1, 5),
('ศัลยกรรม', 'แผนกศัลยกรรม', 40, 1, 3),
('กุมารเวช', 'แผนกกุมารเวช', 30, 1, 7),
('สูติกรรม', 'แผนกสูติกรรม', 35, 1, 4);
GO

-- Create stored procedures for common operations

-- Procedure to add a patient to queue
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'AddPatientToQueue')
    DROP PROCEDURE AddPatientToQueue;
GO

CREATE PROCEDURE AddPatientToQueue
    @hn NVARCHAR(20),
    @patient_name NVARCHAR(200),
    @room_id NVARCHAR(200),
    @department NVARCHAR(100),
    @priority_level NVARCHAR(20) = 'normal'
AS
BEGIN
    DECLARE @queue_number INT;
    DECLARE @room_exists INT = 0;

    -- Check if room exists and is active
    SELECT @room_exists = COUNT(*)
    FROM examination_rooms
    WHERE id = @room_id AND status = 'active';

    IF @room_exists = 0
    BEGIN
        RAISERROR('Room not found or inactive', 16, 1);
        RETURN;
    END;

    -- Get next queue number for the room
    SELECT @queue_number = ISNULL(MAX(queue_number), 0) + 1
    FROM patient_queues
    WHERE room_id = @room_id
    AND LEFT(arrival_time, 8) = CONVERT(CHAR(8), GETDATE(), 112)
    AND status != 'cancelled';

    -- Insert patient into queue
    INSERT INTO patient_queues (
        hn, patient_name, room_id, queue_number,
        department, priority_level, status
    ) VALUES (
        @hn, @patient_name, @room_id, @queue_number,
        @department, @priority_level, 'waiting'
    );

    -- Update room's current queue if this is the first patient
    UPDATE examination_rooms
    SET current_queue = CASE
        WHEN current_queue = 0 THEN @queue_number
        ELSE current_queue
    END
    WHERE id = @room_id;

    -- Log the action
    INSERT INTO queue_history (
        patient_queue_id, action, to_room_id, performed_by, notes
    ) VALUES (
        SCOPE_IDENTITY(), 'created', @room_id, 'SYSTEM',
        CONCAT('Patient added to queue #', @queue_number)
    );

    SELECT @queue_number as queue_number;
END;
GO

-- Procedure to call next patient
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'CallNextPatient')
    DROP PROCEDURE CallNextPatient;
GO

CREATE PROCEDURE CallNextPatient
    @room_id NVARCHAR(200),
    @performed_by NVARCHAR(50)
AS
BEGIN
    DECLARE @current_queue INT;
    DECLARE @next_queue INT;
    DECLARE @patient_id INT;

    -- Get current queue number
    SELECT @current_queue = current_queue
    FROM examination_rooms
    WHERE id = @room_id;

    -- Mark current patient as completed if exists
    IF @current_queue > 0
    BEGIN
        UPDATE patient_queues
        SET status = 'completed', completed_time = (
            CONVERT(CHAR(8), GETDATE(), 112) +
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        )
        WHERE room_id = @room_id
        AND queue_number = @current_queue
        AND status = 'active';
    END;

    -- Find next waiting patient
    SELECT TOP 1 @patient_id = id, @next_queue = queue_number
    FROM patient_queues
    WHERE room_id = @room_id
    AND status = 'waiting'
    AND LEFT(arrival_time, 8) = CONVERT(CHAR(8), GETDATE(), 112)
    ORDER BY
        CASE priority_level
            WHEN 'emergency' THEN 1
            WHEN 'urgent' THEN 2
            WHEN 'normal' THEN 3
        END,
        queue_number ASC;

    IF @patient_id IS NOT NULL
    BEGIN
        -- Mark patient as active
        UPDATE patient_queues
        SET status = 'active', called_time = (
            CONVERT(CHAR(8), GETDATE(), 112) +
            RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
            RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
        )
        WHERE id = @patient_id;

        -- Update room's current queue
        UPDATE examination_rooms
        SET current_queue = @next_queue
        WHERE id = @room_id;

        -- Log the action
        INSERT INTO queue_history (
            patient_queue_id, action, to_room_id, performed_by
        ) VALUES (
            @patient_id, 'called', @room_id, @performed_by
        );

        SELECT @next_queue as next_queue_number;
    END
    ELSE
    BEGIN
        -- No more patients, reset room queue
        UPDATE examination_rooms
        SET current_queue = 0
        WHERE id = @room_id;

        SELECT 0 as next_queue_number;
    END;
END;
GO

-- Create views for easier data access

-- View for active room queues
IF EXISTS (SELECT * FROM sys.views WHERE name = 'active_room_queues')
    DROP VIEW active_room_queues;
GO

CREATE VIEW active_room_queues AS
SELECT
    r.id as room_id,
    r.room_number,
    r.room_name,
    r.department,
    r.floor,
    r.current_queue,
    r.status as room_status,
    COUNT(CASE WHEN pq.status = 'waiting' THEN 1 END) as waiting_count,
    COUNT(CASE WHEN pq.status = 'active' THEN 1 END) as active_count,
    MIN(CASE WHEN pq.status = 'waiting' THEN pq.arrival_time END) as oldest_waiting_time
FROM examination_rooms r
LEFT JOIN patient_queues pq ON r.id = pq.room_id
    AND LEFT(pq.arrival_time, 8) = CONVERT(CHAR(8), GETDATE(), 112)
    AND pq.status IN ('waiting', 'active')
WHERE r.status = 'active'
GROUP BY r.id, r.room_number, r.room_name, r.department, r.floor, r.current_queue, r.status;
GO

-- View for department statistics
IF EXISTS (SELECT * FROM sys.views WHERE name = 'department_stats')
    DROP VIEW department_stats;
GO

CREATE VIEW department_stats AS
SELECT
    r.department,
    COUNT(DISTINCT r.id) as total_rooms,
    COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rooms,
    ISNULL(SUM(CASE WHEN pq.status = 'waiting' THEN 1 ELSE 0 END), 0) as total_waiting,
    ISNULL(SUM(CASE WHEN pq.status = 'active' THEN 1 ELSE 0 END), 0) as total_active,
    ISNULL(AVG(CASE WHEN pq.status = 'waiting' THEN
        DATEDIFF(MINUTE,
            CONVERT(DATETIME, STUFF(STUFF(pq.arrival_time, 9, 0, ' '), 12, 0, ':') + ':00', 120),
            GETDATE()
        )
    END), 0) as avg_waiting_minutes
FROM examination_rooms r
LEFT JOIN patient_queues pq ON r.id = pq.room_id
    AND LEFT(pq.arrival_time, 8) = CONVERT(CHAR(8), GETDATE(), 112)
    AND pq.status IN ('waiting', 'active')
GROUP BY r.department;
GO

-- Create trigger to update updated_at timestamp
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'tr_examination_rooms_update')
    DROP TRIGGER tr_examination_rooms_update;
GO

CREATE TRIGGER tr_examination_rooms_update
ON examination_rooms
AFTER UPDATE
AS
BEGIN
    UPDATE examination_rooms
    SET updated_at = (
        CONVERT(CHAR(8), GETDATE(), 112) +
        RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
        RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
    )
    FROM examination_rooms er
    INNER JOIN inserted i ON er.id = i.id;
END;
GO

-- Create trigger for department_settings
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'tr_department_settings_update')
    DROP TRIGGER tr_department_settings_update;
GO

CREATE TRIGGER tr_department_settings_update
ON department_settings
AFTER UPDATE
AS
BEGIN
    UPDATE department_settings
    SET updated_at = (
        CONVERT(CHAR(8), GETDATE(), 112) +
        RIGHT('0' + CAST(DATEPART(HOUR, GETDATE()) AS VARCHAR(2)), 2) +
        RIGHT('0' + CAST(DATEPART(MINUTE, GETDATE()) AS VARCHAR(2)), 2)
    )
    FROM department_settings ds
    INNER JOIN inserted i ON ds.id = i.id;
END;
GO

PRINT 'Database setup completed successfully!';
PRINT 'Tables created: examination_rooms, patient_queues, queue_history, department_settings';
PRINT 'Stored procedures created: AddPatientToQueue, CallNextPatient';
PRINT 'Views created: active_room_queues, department_stats';
PRINT 'Triggers created: tr_examination_rooms_update, tr_department_settings_update';
PRINT 'Sample data inserted for examination rooms and department settings';
