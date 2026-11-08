SET XACT_ABORT ON;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS [identity].refresh_token;
DROP TABLE IF EXISTS [identity].refresh_token_family;
DROP TABLE IF EXISTS [identity].auth_session;

IF COL_LENGTH(N'identity.account', N'password_changed_at_utc') IS NOT NULL
    ALTER TABLE [identity].account DROP COLUMN password_changed_at_utc;

COMMIT TRANSACTION;
