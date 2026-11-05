SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE platform.tenant (
    tenant_id uniqueidentifier NOT NULL
        CONSTRAINT DF_tenant_id DEFAULT NEWSEQUENTIALID(),
    code varchar(50) NOT NULL,
    display_name nvarchar(180) NOT NULL,
    tenant_type varchar(30) NOT NULL
        CONSTRAINT DF_tenant_type DEFAULT 'INSTITUTION',
    service_status varchar(20) NOT NULL
        CONSTRAINT DF_tenant_service_status DEFAULT 'PENDING',
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_tenant_created_at DEFAULT SYSUTCDATETIME(),
    activated_at_utc datetime2(3) NULL,
    suspended_at_utc datetime2(3) NULL,
    closed_at_utc datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_tenant PRIMARY KEY (tenant_id),
    CONSTRAINT UQ_tenant_code UNIQUE (code),
    CONSTRAINT CK_tenant_code_not_blank CHECK (LEN(LTRIM(RTRIM(code))) > 0),
    CONSTRAINT CK_tenant_name_not_blank CHECK (LEN(LTRIM(RTRIM(display_name))) > 0),
    CONSTRAINT CK_tenant_type CHECK (tenant_type IN ('INSTITUTION', 'INDEPENDENT_CLUB')),
    CONSTRAINT CK_tenant_service_status CHECK (service_status IN ('PENDING', 'ACTIVE', 'READ_ONLY', 'SUSPENDED', 'CLOSED')),
    CONSTRAINT CK_tenant_dates CHECK (
        (activated_at_utc IS NULL OR activated_at_utc >= created_at_utc)
        AND (suspended_at_utc IS NULL OR suspended_at_utc >= created_at_utc)
        AND (closed_at_utc IS NULL OR closed_at_utc >= created_at_utc)
    )
);

CREATE TABLE organization.institution (
    institution_id uniqueidentifier NOT NULL
        CONSTRAINT DF_institution_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    code varchar(50) NOT NULL,
    legal_name nvarchar(200) NOT NULL,
    display_name nvarchar(180) NOT NULL,
    country_code char(2) NULL,
    time_zone_id varchar(100) NOT NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_institution_status DEFAULT 'ACTIVE',
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_institution_created_at DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_institution PRIMARY KEY (institution_id),
    CONSTRAINT FK_institution_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT UQ_institution_tenant_id UNIQUE (tenant_id, institution_id),
    CONSTRAINT UQ_institution_one_per_tenant UNIQUE (tenant_id),
    CONSTRAINT UQ_institution_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT CK_institution_name CHECK (LEN(LTRIM(RTRIM(display_name))) > 0),
    CONSTRAINT CK_institution_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE organization.club (
    club_id uniqueidentifier NOT NULL
        CONSTRAINT DF_club_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    institution_id uniqueidentifier NOT NULL,
    code varchar(50) NOT NULL,
    name nvarchar(180) NOT NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_club_status DEFAULT 'ACTIVE',
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_club_created_at DEFAULT SYSUTCDATETIME(),
    closed_at_utc datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_club PRIMARY KEY (club_id),
    CONSTRAINT FK_club_institution FOREIGN KEY (tenant_id, institution_id)
        REFERENCES organization.institution(tenant_id, institution_id),
    CONSTRAINT UQ_club_tenant_id UNIQUE (tenant_id, club_id),
    CONSTRAINT UQ_club_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT CK_club_name CHECK (LEN(LTRIM(RTRIM(name))) > 0),
    CONSTRAINT CK_club_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'CLOSED')),
    CONSTRAINT CK_club_closed_at CHECK (closed_at_utc IS NULL OR status = 'CLOSED')
);

CREATE TABLE identity.account (
    account_id uniqueidentifier NOT NULL
        CONSTRAINT DF_account_id DEFAULT NEWSEQUENTIALID(),
    email_normalized varchar(320) NOT NULL,
    password_hash varchar(255) NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_account_status DEFAULT 'PENDING_VERIFICATION',
    email_verified_at_utc datetime2(3) NULL,
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_account_created_at DEFAULT SYSUTCDATETIME(),
    last_login_at_utc datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_account PRIMARY KEY (account_id),
    CONSTRAINT UQ_account_email_normalized UNIQUE (email_normalized),
    CONSTRAINT CK_account_email_lower CHECK (email_normalized = LOWER(LTRIM(RTRIM(email_normalized)))),
    CONSTRAINT CK_account_status CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED'))
);

CREATE TABLE identity.person (
    person_id uniqueidentifier NOT NULL
        CONSTRAINT DF_person_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    given_names nvarchar(120) NOT NULL,
    family_name nvarchar(120) NOT NULL,
    second_family_name nvarchar(120) NULL,
    institutional_identifier nvarchar(80) NULL,
    contact_email_normalized varchar(320) NULL,
    phone_e164 varchar(20) NULL,
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_person_created_at DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_person PRIMARY KEY (person_id),
    CONSTRAINT FK_person_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT UQ_person_tenant_id UNIQUE (tenant_id, person_id),
    CONSTRAINT CK_person_given_names CHECK (LEN(LTRIM(RTRIM(given_names))) > 0),
    CONSTRAINT CK_person_family_name CHECK (LEN(LTRIM(RTRIM(family_name))) > 0)
);

CREATE UNIQUE INDEX UX_person_institutional_identifier
    ON identity.person(tenant_id, institutional_identifier)
    WHERE institutional_identifier IS NOT NULL;

CREATE TABLE identity.account_person_link (
    account_person_link_id uniqueidentifier NOT NULL
        CONSTRAINT DF_account_person_link_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    account_id uniqueidentifier NOT NULL,
    person_id uniqueidentifier NOT NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_account_person_link_status DEFAULT 'ACTIVE',
    linked_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_account_person_linked_at DEFAULT SYSUTCDATETIME(),
    unlinked_at_utc datetime2(3) NULL,
    CONSTRAINT PK_account_person_link PRIMARY KEY (account_person_link_id),
    CONSTRAINT FK_account_person_link_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT FK_account_person_link_account FOREIGN KEY (account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT FK_account_person_link_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES identity.person(tenant_id, person_id),
    CONSTRAINT UQ_account_person_link_tenant_id UNIQUE (tenant_id, account_person_link_id),
    CONSTRAINT UQ_account_person_link_account_person UNIQUE (tenant_id, account_id, person_id),
    CONSTRAINT CK_account_person_link_status CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT CK_account_person_link_dates CHECK (unlinked_at_utc IS NULL OR unlinked_at_utc >= linked_at_utc)
);

CREATE UNIQUE INDEX UX_account_person_link_active_account
    ON identity.account_person_link(tenant_id, account_id)
    WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX UX_account_person_link_active_person
    ON identity.account_person_link(tenant_id, person_id)
    WHERE status = 'ACTIVE';

CREATE TABLE membership.club_membership (
    membership_id uniqueidentifier NOT NULL
        CONSTRAINT DF_club_membership_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    person_id uniqueidentifier NOT NULL,
    membership_status varchar(20) NOT NULL
        CONSTRAINT DF_club_membership_status DEFAULT 'PENDING',
    member_condition varchar(20) NOT NULL
        CONSTRAINT DF_club_membership_condition DEFAULT 'ASPIRANT',
    joined_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_club_membership_joined_at DEFAULT SYSUTCDATETIME(),
    ended_at_utc datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_club_membership PRIMARY KEY (membership_id),
    CONSTRAINT FK_club_membership_club FOREIGN KEY (tenant_id, club_id)
        REFERENCES organization.club(tenant_id, club_id),
    CONSTRAINT FK_club_membership_person FOREIGN KEY (tenant_id, person_id)
        REFERENCES identity.person(tenant_id, person_id),
    CONSTRAINT UQ_club_membership_tenant_id UNIQUE (tenant_id, membership_id),
    CONSTRAINT UQ_club_membership_club_id UNIQUE (tenant_id, club_id, membership_id),
    CONSTRAINT UQ_club_membership_person UNIQUE (tenant_id, club_id, person_id),
    CONSTRAINT CK_club_membership_status CHECK (membership_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED')),
    CONSTRAINT CK_club_membership_condition CHECK (member_condition IN ('ASPIRANT', 'COLPORTOR')),
    CONSTRAINT CK_club_membership_dates CHECK (ended_at_utc IS NULL OR ended_at_utc >= joined_at_utc)
);

CREATE TABLE membership.condition_event (
    condition_event_id uniqueidentifier NOT NULL
        CONSTRAINT DF_condition_event_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    membership_id uniqueidentifier NOT NULL,
    previous_condition varchar(20) NULL,
    new_condition varchar(20) NOT NULL,
    transition_method varchar(40) NOT NULL,
    actor_account_id uniqueidentifier NULL,
    actor_access_assignment_id uniqueidentifier NULL,
    reason nvarchar(1000) NULL,
    evidence_json nvarchar(max) NULL,
    occurred_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_condition_event_occurred_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_condition_event PRIMARY KEY (condition_event_id),
    CONSTRAINT FK_condition_event_membership FOREIGN KEY (tenant_id, club_id, membership_id)
        REFERENCES membership.club_membership(tenant_id, club_id, membership_id),
    CONSTRAINT FK_condition_event_actor FOREIGN KEY (actor_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT UQ_condition_event_tenant_id UNIQUE (tenant_id, condition_event_id),
    CONSTRAINT CK_condition_event_previous CHECK (previous_condition IS NULL OR previous_condition IN ('ASPIRANT', 'COLPORTOR')),
    CONSTRAINT CK_condition_event_new CHECK (new_condition IN ('ASPIRANT', 'COLPORTOR')),
    CONSTRAINT CK_condition_event_method CHECK (transition_method IN ('INITIAL_REGISTRATION', 'TRAINING_COMPLETION', 'PRIOR_EXPERIENCE_RECOGNITION', 'ADMIN_CORRECTION')),
    CONSTRAINT CK_condition_event_initial CHECK (
        (transition_method = 'INITIAL_REGISTRATION' AND previous_condition IS NULL AND new_condition = 'ASPIRANT')
        OR (transition_method <> 'INITIAL_REGISTRATION' AND previous_condition IS NOT NULL AND actor_account_id IS NOT NULL AND actor_access_assignment_id IS NOT NULL AND reason IS NOT NULL AND LEN(LTRIM(RTRIM(reason))) > 0)
    ),
    CONSTRAINT CK_condition_event_promotion CHECK (
        transition_method NOT IN ('TRAINING_COMPLETION', 'PRIOR_EXPERIENCE_RECOGNITION')
        OR (previous_condition = 'ASPIRANT' AND new_condition = 'COLPORTOR' AND evidence_json IS NOT NULL)
    ),
    CONSTRAINT CK_condition_event_evidence_json CHECK (evidence_json IS NULL OR ISJSON(evidence_json) = 1)
);

CREATE INDEX IX_condition_event_membership_date
    ON membership.condition_event(tenant_id, membership_id, occurred_at_utc DESC);

CREATE TABLE [authorization].role (
    role_id uniqueidentifier NOT NULL
        CONSTRAINT DF_role_id DEFAULT NEWSEQUENTIALID(),
    code varchar(80) NOT NULL,
    name nvarchar(120) NOT NULL,
    scope_type varchar(20) NOT NULL,
    is_system bit NOT NULL
        CONSTRAINT DF_role_is_system DEFAULT 0,
    status varchar(20) NOT NULL
        CONSTRAINT DF_role_status DEFAULT 'ACTIVE',
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_role_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_role PRIMARY KEY (role_id),
    CONSTRAINT UQ_role_code UNIQUE (code),
    CONSTRAINT UQ_role_id_scope UNIQUE (role_id, scope_type),
    CONSTRAINT CK_role_scope_type CHECK (scope_type IN ('PLATFORM', 'INSTITUTION', 'CLUB')),
    CONSTRAINT CK_role_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE [authorization].permission (
    permission_id uniqueidentifier NOT NULL
        CONSTRAINT DF_permission_id DEFAULT NEWSEQUENTIALID(),
    code varchar(120) NOT NULL,
    name nvarchar(160) NOT NULL,
    module varchar(60) NOT NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_permission_status DEFAULT 'ACTIVE',
    CONSTRAINT PK_permission PRIMARY KEY (permission_id),
    CONSTRAINT UQ_permission_code UNIQUE (code),
    CONSTRAINT CK_permission_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE [authorization].role_permission (
    role_id uniqueidentifier NOT NULL,
    permission_id uniqueidentifier NOT NULL,
    granted_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_role_permission_granted_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_role_permission PRIMARY KEY (role_id, permission_id),
    CONSTRAINT FK_role_permission_role FOREIGN KEY (role_id)
        REFERENCES [authorization].role(role_id),
    CONSTRAINT FK_role_permission_permission FOREIGN KEY (permission_id)
        REFERENCES [authorization].permission(permission_id)
);

CREATE TABLE [authorization].access_assignment (
    access_assignment_id uniqueidentifier NOT NULL
        CONSTRAINT DF_access_assignment_id DEFAULT NEWSEQUENTIALID(),
    account_id uniqueidentifier NOT NULL,
    role_id uniqueidentifier NOT NULL,
    scope_type varchar(20) NOT NULL,
    tenant_id uniqueidentifier NULL,
    institution_id uniqueidentifier NULL,
    club_id uniqueidentifier NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_access_assignment_status DEFAULT 'ACTIVE',
    granted_by_account_id uniqueidentifier NULL,
    granted_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_access_assignment_granted_at DEFAULT SYSUTCDATETIME(),
    expires_at_utc datetime2(3) NULL,
    revoked_at_utc datetime2(3) NULL,
    reason nvarchar(500) NULL,
    CONSTRAINT PK_access_assignment PRIMARY KEY (access_assignment_id),
    CONSTRAINT FK_access_assignment_account FOREIGN KEY (account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT FK_access_assignment_role_scope FOREIGN KEY (role_id, scope_type)
        REFERENCES [authorization].role(role_id, scope_type),
    CONSTRAINT FK_access_assignment_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT FK_access_assignment_institution FOREIGN KEY (tenant_id, institution_id)
        REFERENCES organization.institution(tenant_id, institution_id),
    CONSTRAINT FK_access_assignment_club FOREIGN KEY (tenant_id, club_id)
        REFERENCES organization.club(tenant_id, club_id),
    CONSTRAINT FK_access_assignment_granted_by FOREIGN KEY (granted_by_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT UQ_access_assignment_tenant_account_id UNIQUE (tenant_id, account_id, access_assignment_id),
    CONSTRAINT CK_access_assignment_scope_shape CHECK (
        (scope_type = 'PLATFORM' AND tenant_id IS NULL AND institution_id IS NULL AND club_id IS NULL)
        OR (scope_type = 'INSTITUTION' AND tenant_id IS NOT NULL AND institution_id IS NOT NULL AND club_id IS NULL)
        OR (scope_type = 'CLUB' AND tenant_id IS NOT NULL AND institution_id IS NULL AND club_id IS NOT NULL)
    ),
    CONSTRAINT CK_access_assignment_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    CONSTRAINT CK_access_assignment_dates CHECK (
        (expires_at_utc IS NULL OR expires_at_utc >= granted_at_utc)
        AND (revoked_at_utc IS NULL OR revoked_at_utc >= granted_at_utc)
    )
);

CREATE UNIQUE INDEX UX_access_assignment_active
    ON [authorization].access_assignment(account_id, role_id, scope_type, tenant_id, institution_id, club_id)
    WHERE status = 'ACTIVE';

CREATE INDEX IX_access_assignment_account_status
    ON [authorization].access_assignment(account_id, status, expires_at_utc);

ALTER TABLE membership.condition_event
ADD CONSTRAINT FK_condition_event_actor_assignment
    FOREIGN KEY (tenant_id, actor_account_id, actor_access_assignment_id)
    REFERENCES [authorization].access_assignment(tenant_id, account_id, access_assignment_id);

CREATE TABLE organization.club_position (
    position_id uniqueidentifier NOT NULL
        CONSTRAINT DF_club_position_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    code varchar(60) NOT NULL,
    name nvarchar(120) NOT NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_club_position_status DEFAULT 'ACTIVE',
    CONSTRAINT PK_club_position PRIMARY KEY (position_id),
    CONSTRAINT FK_club_position_club FOREIGN KEY (tenant_id, club_id)
        REFERENCES organization.club(tenant_id, club_id),
    CONSTRAINT UQ_club_position_tenant_id UNIQUE (tenant_id, position_id),
    CONSTRAINT UQ_club_position_club_id UNIQUE (tenant_id, club_id, position_id),
    CONSTRAINT UQ_club_position_code UNIQUE (tenant_id, club_id, code),
    CONSTRAINT CK_club_position_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE organization.position_assignment (
    position_assignment_id uniqueidentifier NOT NULL
        CONSTRAINT DF_position_assignment_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    position_id uniqueidentifier NOT NULL,
    membership_id uniqueidentifier NOT NULL,
    starts_on date NOT NULL,
    ends_on date NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_position_assignment_status DEFAULT 'ACTIVE',
    assigned_by_account_id uniqueidentifier NOT NULL,
    assigned_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_position_assignment_assigned_at DEFAULT SYSUTCDATETIME(),
    reason nvarchar(500) NULL,
    CONSTRAINT PK_position_assignment PRIMARY KEY (position_assignment_id),
    CONSTRAINT FK_position_assignment_position FOREIGN KEY (tenant_id, club_id, position_id)
        REFERENCES organization.club_position(tenant_id, club_id, position_id),
    CONSTRAINT FK_position_assignment_membership FOREIGN KEY (tenant_id, club_id, membership_id)
        REFERENCES membership.club_membership(tenant_id, club_id, membership_id),
    CONSTRAINT FK_position_assignment_actor FOREIGN KEY (assigned_by_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT UQ_position_assignment_tenant_id UNIQUE (tenant_id, position_assignment_id),
    CONSTRAINT CK_position_assignment_dates CHECK (ends_on IS NULL OR ends_on >= starts_on),
    CONSTRAINT CK_position_assignment_status CHECK (status IN ('ACTIVE', 'ENDED', 'REVOKED'))
);

CREATE UNIQUE INDEX UX_position_assignment_active_position
    ON organization.position_assignment(tenant_id, club_id, position_id, membership_id)
    WHERE status = 'ACTIVE';

CREATE TABLE identity.action_token (
    action_token_id uniqueidentifier NOT NULL
        CONSTRAINT DF_action_token_id DEFAULT NEWSEQUENTIALID(),
    purpose varchar(40) NOT NULL,
    token_hash binary(32) NOT NULL,
    account_id uniqueidentifier NULL,
    tenant_id uniqueidentifier NULL,
    club_id uniqueidentifier NULL,
    target_email_normalized varchar(320) NULL,
    redirect_key varchar(80) NULL,
    metadata_json nvarchar(max) NULL,
    issued_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_action_token_issued_at DEFAULT SYSUTCDATETIME(),
    expires_at_utc datetime2(3) NOT NULL,
    consumed_at_utc datetime2(3) NULL,
    revoked_at_utc datetime2(3) NULL,
    created_by_account_id uniqueidentifier NULL,
    CONSTRAINT PK_action_token PRIMARY KEY (action_token_id),
    CONSTRAINT UQ_action_token_hash UNIQUE (token_hash),
    CONSTRAINT FK_action_token_account FOREIGN KEY (account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT FK_action_token_club FOREIGN KEY (tenant_id, club_id)
        REFERENCES organization.club(tenant_id, club_id),
    CONSTRAINT FK_action_token_created_by FOREIGN KEY (created_by_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT CK_action_token_purpose CHECK (purpose IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'CLUB_INVITATION')),
    CONSTRAINT CK_action_token_scope CHECK (
        (purpose = 'CLUB_INVITATION' AND tenant_id IS NOT NULL AND club_id IS NOT NULL AND target_email_normalized IS NOT NULL)
        OR (purpose IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET') AND tenant_id IS NULL AND club_id IS NULL AND account_id IS NOT NULL)
    ),
    CONSTRAINT CK_action_token_dates CHECK (
        expires_at_utc > issued_at_utc
        AND (consumed_at_utc IS NULL OR consumed_at_utc >= issued_at_utc)
        AND (revoked_at_utc IS NULL OR revoked_at_utc >= issued_at_utc)
        AND NOT (consumed_at_utc IS NOT NULL AND revoked_at_utc IS NOT NULL)
    ),
    CONSTRAINT CK_action_token_metadata_json CHECK (metadata_json IS NULL OR ISJSON(metadata_json) = 1)
);

CREATE INDEX IX_action_token_lookup
    ON identity.action_token(purpose, expires_at_utc)
    INCLUDE (consumed_at_utc, revoked_at_utc, account_id, tenant_id, club_id);

CREATE TABLE platform.tenant_service_state_event (
    tenant_service_state_event_id uniqueidentifier NOT NULL
        CONSTRAINT DF_tenant_service_state_event_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    previous_status varchar(20) NULL,
    new_status varchar(20) NOT NULL,
    actor_account_id uniqueidentifier NULL,
    reason nvarchar(1000) NOT NULL,
    occurred_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_tenant_service_state_event_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_tenant_service_state_event PRIMARY KEY (tenant_service_state_event_id),
    CONSTRAINT FK_tenant_service_state_event_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT FK_tenant_service_state_event_actor FOREIGN KEY (actor_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT UQ_tenant_service_state_event_tenant_id UNIQUE (tenant_id, tenant_service_state_event_id),
    CONSTRAINT CK_tenant_service_state_event_previous CHECK (previous_status IS NULL OR previous_status IN ('PENDING', 'ACTIVE', 'READ_ONLY', 'SUSPENDED', 'CLOSED')),
    CONSTRAINT CK_tenant_service_state_event_new CHECK (new_status IN ('PENDING', 'ACTIVE', 'READ_ONLY', 'SUSPENDED', 'CLOSED')),
    CONSTRAINT CK_tenant_service_state_event_reason CHECK (LEN(LTRIM(RTRIM(reason))) > 0)
);

CREATE INDEX IX_tenant_service_state_event_tenant_date
    ON platform.tenant_service_state_event(tenant_id, occurred_at_utc DESC);

CREATE TABLE audit.audit_event (
    audit_event_id bigint IDENTITY(1,1) NOT NULL,
    tenant_id uniqueidentifier NULL,
    actor_account_id uniqueidentifier NULL,
    action varchar(100) NOT NULL,
    entity_type varchar(100) NOT NULL,
    entity_id nvarchar(100) NULL,
    correlation_id uniqueidentifier NOT NULL,
    reason nvarchar(1000) NULL,
    before_json nvarchar(max) NULL,
    after_json nvarchar(max) NULL,
    occurred_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_audit_event_occurred_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_audit_event PRIMARY KEY (audit_event_id),
    CONSTRAINT FK_audit_event_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT FK_audit_event_actor FOREIGN KEY (actor_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT CK_audit_event_before_json CHECK (before_json IS NULL OR ISJSON(before_json) = 1),
    CONSTRAINT CK_audit_event_after_json CHECK (after_json IS NULL OR ISJSON(after_json) = 1)
);

CREATE INDEX IX_audit_event_tenant_date
    ON audit.audit_event(tenant_id, occurred_at_utc DESC)
    INCLUDE (action, entity_type, entity_id, actor_account_id, correlation_id);

CREATE TABLE audit.idempotency_record (
    idempotency_record_id uniqueidentifier NOT NULL
        CONSTRAINT DF_idempotency_record_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NULL,
    actor_account_id uniqueidentifier NULL,
    subject_hash binary(32) NOT NULL,
    operation varchar(100) NOT NULL,
    idempotency_key varchar(100) NOT NULL,
    request_hash binary(32) NOT NULL,
    status varchar(20) NOT NULL
        CONSTRAINT DF_idempotency_record_status DEFAULT 'PROCESSING',
    response_status smallint NULL,
    response_json nvarchar(max) NULL,
    resource_type varchar(100) NULL,
    resource_id nvarchar(100) NULL,
    created_at_utc datetime2(3) NOT NULL
        CONSTRAINT DF_idempotency_record_created_at DEFAULT SYSUTCDATETIME(),
    completed_at_utc datetime2(3) NULL,
    expires_at_utc datetime2(3) NULL,
    CONSTRAINT PK_idempotency_record PRIMARY KEY (idempotency_record_id),
    CONSTRAINT FK_idempotency_record_tenant FOREIGN KEY (tenant_id)
        REFERENCES platform.tenant(tenant_id),
    CONSTRAINT FK_idempotency_record_actor FOREIGN KEY (actor_account_id)
        REFERENCES identity.account(account_id),
    CONSTRAINT CK_idempotency_record_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT CK_idempotency_record_response_status CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
    CONSTRAINT CK_idempotency_record_response_json CHECK (response_json IS NULL OR ISJSON(response_json) = 1),
    CONSTRAINT CK_idempotency_record_dates CHECK (
        (completed_at_utc IS NULL OR completed_at_utc >= created_at_utc)
        AND (expires_at_utc IS NULL OR expires_at_utc >= created_at_utc)
    )
);

CREATE UNIQUE INDEX UX_idempotency_record_tenant
    ON audit.idempotency_record(tenant_id, subject_hash, operation, idempotency_key)
    WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX UX_idempotency_record_platform
    ON audit.idempotency_record(subject_hash, operation, idempotency_key)
    WHERE tenant_id IS NULL;

COMMIT TRANSACTION;
