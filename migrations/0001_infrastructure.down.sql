SET XACT_ABORT ON;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS infra.schema_migration;

IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'audit') EXEC(N'DROP SCHEMA audit');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'authorization') EXEC(N'DROP SCHEMA [authorization]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'membership') EXEC(N'DROP SCHEMA membership');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'identity') EXEC(N'DROP SCHEMA [identity]');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'organization') EXEC(N'DROP SCHEMA organization');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'platform') EXEC(N'DROP SCHEMA platform');
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'infra') EXEC(N'DROP SCHEMA infra');

COMMIT TRANSACTION;
