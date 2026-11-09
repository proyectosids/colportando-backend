SET XACT_ABORT ON; BEGIN TRANSACTION;
DELETE rp FROM [C_authorization].role_permission rp JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id WHERE p.code LIKE 'operations.%';
DELETE FROM [C_authorization].permission WHERE code LIKE 'operations.%';
DROP TABLE IF EXISTS [C_operations].group_change_appeal; DROP TABLE IF EXISTS [C_operations].group_change_request; DROP TABLE IF EXISTS [C_operations].field_assignment; DROP TABLE IF EXISTS [C_operations].operational_field; DROP TABLE IF EXISTS [C_operations].associate_assignment; DROP TABLE IF EXISTS [C_operations].group_assignment; DROP TABLE IF EXISTS [C_operations].campaign_group; DROP TABLE IF EXISTS [C_operations].campaign_participation; DROP TABLE IF EXISTS [C_operations].campaign;
IF EXISTS(SELECT 1 FROM sys.schemas WHERE name=N'C_operations') EXEC(N'DROP SCHEMA [C_operations]');
COMMIT TRANSACTION;
