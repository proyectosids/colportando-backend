SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'infra') EXEC(N'CREATE SCHEMA infra');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'platform') EXEC(N'CREATE SCHEMA platform');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'organization') EXEC(N'CREATE SCHEMA organization');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'identity') EXEC(N'CREATE SCHEMA identity');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'membership') EXEC(N'CREATE SCHEMA membership');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'authorization') EXEC(N'CREATE SCHEMA [authorization]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'audit') EXEC(N'CREATE SCHEMA audit');

CREATE TABLE infra.schema_migration (
    version varchar(40) NOT NULL,
    name nvarchar(200) NOT NULL,
    checksum char(64) NOT NULL,
    applied_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_schema_migration_applied_at DEFAULT SYSUTCDATETIME(),
    execution_ms int NOT NULL,
    CONSTRAINT PK_schema_migration PRIMARY KEY (version),
    CONSTRAINT CK_schema_migration_execution_ms CHECK (execution_ms >= 0),
    CONSTRAINT CK_schema_migration_checksum CHECK (checksum NOT LIKE '%[^0-9A-Fa-f]%')
);

COMMIT TRANSACTION;
