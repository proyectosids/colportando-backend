SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_training')
    EXEC(N'CREATE SCHEMA [C_training] AUTHORIZATION [dbo]');

CREATE TABLE [C_training].training_program (
    program_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    code varchar(60) NOT NULL,
    name nvarchar(180) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_program_status DEFAULT 'ACTIVE',
    created_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_training_program_created_at DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_training_program PRIMARY KEY (program_id),
    CONSTRAINT UQ_training_program_tenant_id UNIQUE (tenant_id, program_id),
    CONSTRAINT UQ_training_program_club_id UNIQUE (tenant_id, club_id, program_id),
    CONSTRAINT UQ_training_program_code UNIQUE (tenant_id, club_id, code),
    CONSTRAINT FK_training_program_club FOREIGN KEY (tenant_id, club_id) REFERENCES [C_organization].club(tenant_id, club_id),
    CONSTRAINT FK_training_program_actor FOREIGN KEY (created_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_training_program_code CHECK (LEN(LTRIM(RTRIM(code))) > 0 AND code = UPPER(code)),
    CONSTRAINT CK_training_program_name CHECK (LEN(LTRIM(RTRIM(name))) > 0),
    CONSTRAINT CK_training_program_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE [C_training].program_version (
    program_version_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    program_id uniqueidentifier NOT NULL,
    version_number int NOT NULL,
    label nvarchar(120) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_program_version_status DEFAULT 'ACTIVE',
    starts_on date NULL,
    ends_on date NULL,
    created_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_program_version_created_at DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_program_version PRIMARY KEY (program_version_id),
    CONSTRAINT UQ_program_version_tenant_id UNIQUE (tenant_id, program_version_id),
    CONSTRAINT UQ_program_version_club_id UNIQUE (tenant_id, club_id, program_version_id),
    CONSTRAINT UQ_program_version_number UNIQUE (tenant_id, program_id, version_number),
    CONSTRAINT FK_program_version_program FOREIGN KEY (tenant_id, club_id, program_id) REFERENCES [C_training].training_program(tenant_id, club_id, program_id),
    CONSTRAINT FK_program_version_actor FOREIGN KEY (created_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_program_version_number CHECK (version_number > 0),
    CONSTRAINT CK_program_version_label CHECK (LEN(LTRIM(RTRIM(label))) > 0),
    CONSTRAINT CK_program_version_status CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
    CONSTRAINT CK_program_version_dates CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE [C_training].training_session (
    session_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    program_version_id uniqueidentifier NOT NULL,
    title nvarchar(180) NOT NULL,
    starts_at_utc datetime2(3) NOT NULL,
    ends_at_utc datetime2(3) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_session_status DEFAULT 'OPEN',
    created_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_training_session_created_at DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_training_session PRIMARY KEY (session_id),
    CONSTRAINT UQ_training_session_tenant_id UNIQUE (tenant_id, session_id),
    CONSTRAINT UQ_training_session_club_id UNIQUE (tenant_id, club_id, session_id),
    CONSTRAINT FK_training_session_version FOREIGN KEY (tenant_id, club_id, program_version_id) REFERENCES [C_training].program_version(tenant_id, club_id, program_version_id),
    CONSTRAINT FK_training_session_actor FOREIGN KEY (created_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_training_session_title CHECK (LEN(LTRIM(RTRIM(title))) > 0),
    CONSTRAINT CK_training_session_dates CHECK (ends_at_utc > starts_at_utc),
    CONSTRAINT CK_training_session_status CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED'))
);

CREATE TABLE [C_training].enrollment (
    enrollment_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    program_version_id uniqueidentifier NOT NULL,
    membership_id uniqueidentifier NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_enrollment_status DEFAULT 'ENROLLED',
    enrolled_by_account_id uniqueidentifier NOT NULL,
    enrolled_at_utc datetime2(3) NOT NULL CONSTRAINT DF_training_enrollment_at DEFAULT SYSUTCDATETIME(),
    withdrawn_at_utc datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_training_enrollment PRIMARY KEY (enrollment_id),
    CONSTRAINT UQ_training_enrollment_tenant_id UNIQUE (tenant_id, enrollment_id),
    CONSTRAINT UQ_training_enrollment_club_id UNIQUE (tenant_id, club_id, enrollment_id),
    CONSTRAINT UQ_training_enrollment_member UNIQUE (tenant_id, program_version_id, membership_id),
    CONSTRAINT FK_training_enrollment_version FOREIGN KEY (tenant_id, club_id, program_version_id) REFERENCES [C_training].program_version(tenant_id, club_id, program_version_id),
    CONSTRAINT FK_training_enrollment_membership FOREIGN KEY (tenant_id, club_id, membership_id) REFERENCES [C_membership].club_membership(tenant_id, club_id, membership_id),
    CONSTRAINT FK_training_enrollment_actor FOREIGN KEY (enrolled_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_training_enrollment_status CHECK (status IN ('ENROLLED', 'WITHDRAWN')),
    CONSTRAINT CK_training_enrollment_dates CHECK ((status = 'ENROLLED' AND withdrawn_at_utc IS NULL) OR (status = 'WITHDRAWN' AND withdrawn_at_utc IS NOT NULL AND withdrawn_at_utc >= enrolled_at_utc))
);

CREATE TABLE [C_training].session_attendance (
    attendance_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    session_id uniqueidentifier NOT NULL,
    enrollment_id uniqueidentifier NOT NULL,
    attendance_status varchar(20) NOT NULL,
    notes nvarchar(500) NULL,
    recorded_by_account_id uniqueidentifier NOT NULL,
    recorded_at_utc datetime2(3) NOT NULL,
    updated_at_utc datetime2(3) NOT NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_session_attendance PRIMARY KEY (attendance_id),
    CONSTRAINT UQ_session_attendance_tenant_id UNIQUE (tenant_id, attendance_id),
    CONSTRAINT UQ_session_attendance_once UNIQUE (tenant_id, session_id, enrollment_id),
    CONSTRAINT FK_session_attendance_session FOREIGN KEY (tenant_id, club_id, session_id) REFERENCES [C_training].training_session(tenant_id, club_id, session_id),
    CONSTRAINT FK_session_attendance_enrollment FOREIGN KEY (tenant_id, club_id, enrollment_id) REFERENCES [C_training].enrollment(tenant_id, club_id, enrollment_id),
    CONSTRAINT FK_session_attendance_actor FOREIGN KEY (recorded_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_session_attendance_status CHECK (attendance_status IN ('PRESENT', 'ABSENT', 'EXCUSED')),
    CONSTRAINT CK_session_attendance_dates CHECK (updated_at_utc >= recorded_at_utc)
);

CREATE INDEX IX_training_session_version_date ON [C_training].training_session(tenant_id, program_version_id, starts_at_utc);
CREATE INDEX IX_training_enrollment_membership ON [C_training].enrollment(tenant_id, membership_id, status);
CREATE INDEX IX_session_attendance_enrollment ON [C_training].session_attendance(tenant_id, enrollment_id, session_id);

IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code = 'training.program.manage')
    INSERT INTO [C_authorization].permission (permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A01','training.program.manage',N'Administrar programas de capacitación','TRAINING','ACTIVE');
IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code = 'training.session.manage')
    INSERT INTO [C_authorization].permission (permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A02','training.session.manage',N'Administrar sesiones de capacitación','TRAINING','ACTIVE');
IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code = 'training.enrollment.manage')
    INSERT INTO [C_authorization].permission (permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A03','training.enrollment.manage',N'Inscribir aspirantes en capacitación','TRAINING','ACTIVE');
IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code = 'training.attendance.record')
    INSERT INTO [C_authorization].permission (permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A04','training.attendance.record',N'Registrar asistencias de capacitación','TRAINING','ACTIVE');
IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code = 'training.progress.read')
    INSERT INTO [C_authorization].permission (permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A05','training.progress.read',N'Consultar avance de capacitación','TRAINING','ACTIVE');

COMMIT TRANSACTION;
