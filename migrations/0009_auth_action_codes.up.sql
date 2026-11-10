SET XACT_ABORT ON;
BEGIN TRANSACTION;

ALTER TABLE [C_identity].action_token ADD
    failed_attempt_count int NOT NULL CONSTRAINT DF_action_token_failed_attempts DEFAULT (0),
    max_attempts int NOT NULL CONSTRAINT DF_action_token_max_attempts DEFAULT (5);

EXEC(N'ALTER TABLE [C_identity].action_token ADD CONSTRAINT CK_action_token_attempts
    CHECK (failed_attempt_count >= 0 AND max_attempts BETWEEN 1 AND 20 AND failed_attempt_count <= max_attempts);');

EXEC(N'CREATE INDEX IX_action_token_email_code
    ON [C_identity].action_token(purpose, target_email_normalized, issued_at_utc DESC)
    INCLUDE (token_hash, expires_at_utc, consumed_at_utc, revoked_at_utc, failed_attempt_count, max_attempts, account_id);');

COMMIT TRANSACTION;
