SET XACT_ABORT ON;
BEGIN TRANSACTION;

DELETE rp FROM [C_authorization].role_permission rp
JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id
WHERE p.code IN ('training.program.manage','training.session.manage','training.enrollment.manage','training.attendance.record','training.progress.read');
DELETE FROM [C_authorization].permission WHERE code IN ('training.program.manage','training.session.manage','training.enrollment.manage','training.attendance.record','training.progress.read');

DROP TABLE IF EXISTS [C_training].session_attendance;
DROP TABLE IF EXISTS [C_training].enrollment;
DROP TABLE IF EXISTS [C_training].training_session;
DROP TABLE IF EXISTS [C_training].program_version;
DROP TABLE IF EXISTS [C_training].training_program;
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name=N'C_training') EXEC(N'DROP SCHEMA [C_training]');

COMMIT TRANSACTION;
