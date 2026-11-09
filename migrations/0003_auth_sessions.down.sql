SET XACT_ABORT ON;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS [C_identity].refresh_token;
DROP TABLE IF EXISTS [C_identity].refresh_token_family;
DROP TABLE IF EXISTS [C_identity].auth_session;

IF COL_LENGTH(N'C_identity.account', N'password_changed_at_utc') IS NOT NULL
    ALTER TABLE [C_identity].account DROP COLUMN password_changed_at_utc;

COMMIT TRANSACTION;
