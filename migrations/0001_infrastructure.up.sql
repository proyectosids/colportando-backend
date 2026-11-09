SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_infra') EXEC(N'CREATE SCHEMA [C_infra]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_platform') EXEC(N'CREATE SCHEMA [C_platform]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_organization') EXEC(N'CREATE SCHEMA [C_organization]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_identity') EXEC(N'CREATE SCHEMA [C_identity]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_membership') EXEC(N'CREATE SCHEMA [C_membership]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_authorization') EXEC(N'CREATE SCHEMA [C_authorization]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_audit') EXEC(N'CREATE SCHEMA [C_audit]');

CREATE TABLE [C_infra].schema_migration (
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
