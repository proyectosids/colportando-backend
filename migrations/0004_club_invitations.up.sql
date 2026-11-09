SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [C_membership].club_invitation (
    invitation_id uniqueidentifier NOT NULL CONSTRAINT DF_club_invitation_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    action_token_id uniqueidentifier NOT NULL,
    target_email_normalized varchar(320) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_club_invitation_status DEFAULT 'PENDING',
    invited_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_club_invitation_created_at DEFAULT SYSUTCDATETIME(),
    expires_at_utc datetime2(3) NOT NULL,
    accepted_at_utc datetime2(3) NULL,
    revoked_at_utc datetime2(3) NULL,
    accepted_account_id uniqueidentifier NULL,
    accepted_person_id uniqueidentifier NULL,
    membership_id uniqueidentifier NULL,
    CONSTRAINT PK_club_invitation PRIMARY KEY (invitation_id),
    CONSTRAINT UQ_club_invitation_action_token UNIQUE (action_token_id),
    CONSTRAINT UQ_club_invitation_tenant_id UNIQUE (tenant_id, invitation_id),
    CONSTRAINT FK_club_invitation_club FOREIGN KEY (tenant_id, club_id) REFERENCES [C_organization].club(tenant_id, club_id),
    CONSTRAINT FK_club_invitation_action_token FOREIGN KEY (action_token_id) REFERENCES [C_identity].action_token(action_token_id),
    CONSTRAINT FK_club_invitation_inviter FOREIGN KEY (invited_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT FK_club_invitation_account FOREIGN KEY (accepted_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT FK_club_invitation_person FOREIGN KEY (tenant_id, accepted_person_id) REFERENCES [C_identity].person(tenant_id, person_id),
    CONSTRAINT FK_club_invitation_membership FOREIGN KEY (tenant_id, club_id, membership_id) REFERENCES [C_membership].club_membership(tenant_id, club_id, membership_id),
    CONSTRAINT CK_club_invitation_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    CONSTRAINT CK_club_invitation_dates CHECK (expires_at_utc > created_at_utc AND (accepted_at_utc IS NULL OR accepted_at_utc >= created_at_utc) AND (revoked_at_utc IS NULL OR revoked_at_utc >= created_at_utc)),
    CONSTRAINT CK_club_invitation_result CHECK (
        (status = 'PENDING' AND accepted_at_utc IS NULL AND revoked_at_utc IS NULL AND accepted_account_id IS NULL AND accepted_person_id IS NULL AND membership_id IS NULL)
        OR (status = 'ACCEPTED' AND accepted_at_utc IS NOT NULL AND revoked_at_utc IS NULL AND accepted_account_id IS NOT NULL AND accepted_person_id IS NOT NULL AND membership_id IS NOT NULL)
        OR (status IN ('REVOKED', 'EXPIRED') AND accepted_at_utc IS NULL AND revoked_at_utc IS NOT NULL AND accepted_account_id IS NULL AND accepted_person_id IS NULL AND membership_id IS NULL)
    )
);

CREATE UNIQUE INDEX UX_club_invitation_pending
    ON [C_membership].club_invitation(tenant_id, club_id, target_email_normalized)
    WHERE status = 'PENDING';

CREATE INDEX IX_club_invitation_target_status
    ON [C_membership].club_invitation(target_email_normalized, status, expires_at_utc);

IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code = 'membership.invitation.create')
BEGIN
    INSERT INTO [C_authorization].permission (permission_id, code, name, module, status)
    VALUES ('2D9D1160-EEA8-4A3C-B34A-ED324A7E4477', 'membership.invitation.create', N'Crear invitaciones de club', 'MEMBERSHIP', 'ACTIVE');
END;

COMMIT TRANSACTION;
