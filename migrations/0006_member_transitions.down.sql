SET XACT_ABORT ON;
BEGIN TRANSACTION;
DELETE rp FROM [C_authorization].role_permission rp JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id WHERE p.code IN ('training.promotion.decide','membership.experience-recognition.decide','membership.transition-history.read');
DELETE FROM [C_authorization].permission WHERE code IN ('training.promotion.decide','membership.experience-recognition.decide','membership.transition-history.read');
DROP TABLE IF EXISTS [C_membership].experience_recognition;
DROP TABLE IF EXISTS [C_training].promotion_decision;
ALTER TABLE [C_training].program_version DROP CONSTRAINT CK_program_version_criteria_shape,CK_program_version_criteria_json,FK_program_version_criteria_actor;
ALTER TABLE [C_training].program_version DROP COLUMN promotion_criteria_json,criteria_configured_by_account_id,criteria_configured_at_utc;
COMMIT TRANSACTION;
