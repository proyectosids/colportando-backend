SET XACT_ABORT ON;
BEGIN TRANSACTION;

EXEC(N'DROP INDEX IX_action_token_email_code ON [C_identity].action_token;');
EXEC(N'ALTER TABLE [C_identity].action_token DROP CONSTRAINT CK_action_token_attempts;');
EXEC(N'ALTER TABLE [C_identity].action_token DROP CONSTRAINT DF_action_token_failed_attempts;');
EXEC(N'ALTER TABLE [C_identity].action_token DROP CONSTRAINT DF_action_token_max_attempts;');
EXEC(N'ALTER TABLE [C_identity].action_token DROP COLUMN failed_attempt_count, max_attempts;');

COMMIT TRANSACTION;
