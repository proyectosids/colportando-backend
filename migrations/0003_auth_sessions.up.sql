SET XACT_ABORT ON;
BEGIN TRANSACTION;

ALTER TABLE [C_identity].account
ADD password_changed_at_utc datetime2(3) NULL;

CREATE TABLE [C_identity].auth_session (
    session_id uniqueidentifier NOT NULL CONSTRAINT DF_auth_session_id DEFAULT NEWSEQUENTIALID(),
    account_id uniqueidentifier NOT NULL,
    client_name nvarchar(120) NULL,
    ip_address varchar(45) NULL,
    user_agent nvarchar(500) NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_auth_session_created_at DEFAULT SYSUTCDATETIME(),
    last_seen_at_utc datetime2(3) NOT NULL CONSTRAINT DF_auth_session_last_seen_at DEFAULT SYSUTCDATETIME(),
    expires_at_utc datetime2(3) NOT NULL,
    revoked_at_utc datetime2(3) NULL,
    revocation_reason varchar(40) NULL,
    CONSTRAINT PK_auth_session PRIMARY KEY (session_id),
    CONSTRAINT FK_auth_session_account FOREIGN KEY (account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_auth_session_dates CHECK (expires_at_utc > created_at_utc AND (revoked_at_utc IS NULL OR revoked_at_utc >= created_at_utc)),
    CONSTRAINT CK_auth_session_revocation CHECK ((revoked_at_utc IS NULL AND revocation_reason IS NULL) OR (revoked_at_utc IS NOT NULL AND revocation_reason IS NOT NULL))
);

CREATE INDEX IX_auth_session_account_status
    ON [C_identity].auth_session(account_id, revoked_at_utc, expires_at_utc);

CREATE TABLE [C_identity].refresh_token_family (
    family_id uniqueidentifier NOT NULL CONSTRAINT DF_refresh_token_family_id DEFAULT NEWSEQUENTIALID(),
    session_id uniqueidentifier NOT NULL,
    account_id uniqueidentifier NOT NULL,
    current_generation int NOT NULL CONSTRAINT DF_refresh_token_family_generation DEFAULT 0,
    status varchar(20) NOT NULL CONSTRAINT DF_refresh_token_family_status DEFAULT 'ACTIVE',
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_refresh_token_family_created_at DEFAULT SYSUTCDATETIME(),
    revoked_at_utc datetime2(3) NULL,
    revocation_reason varchar(40) NULL,
    CONSTRAINT PK_refresh_token_family PRIMARY KEY (family_id),
    CONSTRAINT UQ_refresh_token_family_session UNIQUE (session_id),
    CONSTRAINT FK_refresh_token_family_session FOREIGN KEY (session_id) REFERENCES [C_identity].auth_session(session_id),
    CONSTRAINT FK_refresh_token_family_account FOREIGN KEY (account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_refresh_token_family_generation CHECK (current_generation >= 0),
    CONSTRAINT CK_refresh_token_family_status CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT CK_refresh_token_family_revocation CHECK ((status = 'ACTIVE' AND revoked_at_utc IS NULL AND revocation_reason IS NULL) OR (status = 'REVOKED' AND revoked_at_utc IS NOT NULL AND revocation_reason IS NOT NULL))
);

CREATE TABLE [C_identity].refresh_token (
    refresh_token_id uniqueidentifier NOT NULL CONSTRAINT DF_refresh_token_id DEFAULT NEWSEQUENTIALID(),
    family_id uniqueidentifier NOT NULL,
    generation int NOT NULL,
    token_hash binary(32) NOT NULL,
    issued_at_utc datetime2(3) NOT NULL CONSTRAINT DF_refresh_token_issued_at DEFAULT SYSUTCDATETIME(),
    expires_at_utc datetime2(3) NOT NULL,
    consumed_at_utc datetime2(3) NULL,
    replaced_by_token_id uniqueidentifier NULL,
    revoked_at_utc datetime2(3) NULL,
    CONSTRAINT PK_refresh_token PRIMARY KEY (refresh_token_id),
    CONSTRAINT UQ_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT UQ_refresh_token_family_generation UNIQUE (family_id, generation),
    CONSTRAINT FK_refresh_token_family FOREIGN KEY (family_id) REFERENCES [C_identity].refresh_token_family(family_id),
    CONSTRAINT FK_refresh_token_replacement FOREIGN KEY (replaced_by_token_id) REFERENCES [C_identity].refresh_token(refresh_token_id),
    CONSTRAINT CK_refresh_token_generation CHECK (generation >= 0),
    CONSTRAINT CK_refresh_token_dates CHECK (expires_at_utc > issued_at_utc AND (consumed_at_utc IS NULL OR consumed_at_utc >= issued_at_utc) AND (revoked_at_utc IS NULL OR revoked_at_utc >= issued_at_utc)),
    CONSTRAINT CK_refresh_token_consumption CHECK ((consumed_at_utc IS NULL AND replaced_by_token_id IS NULL) OR consumed_at_utc IS NOT NULL)
);

CREATE INDEX IX_refresh_token_family_status
    ON [C_identity].refresh_token(family_id, expires_at_utc)
    INCLUDE (consumed_at_utc, revoked_at_utc);

COMMIT TRANSACTION;
