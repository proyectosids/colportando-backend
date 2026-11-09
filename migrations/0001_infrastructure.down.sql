SET XACT_ABORT ON;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS [C_infra].schema_migration;

IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_audit') EXEC(N'DROP SCHEMA [C_audit]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_authorization') EXEC(N'DROP SCHEMA [C_authorization]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_membership') EXEC(N'DROP SCHEMA [C_membership]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_identity') EXEC(N'DROP SCHEMA [C_identity]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_organization') EXEC(N'DROP SCHEMA [C_organization]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_platform') EXEC(N'DROP SCHEMA [C_platform]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'C_infra') EXEC(N'DROP SCHEMA [C_infra]');

COMMIT TRANSACTION;
