SET XACT_ABORT ON;
BEGIN TRANSACTION;

ALTER TABLE [C_training].program_version ADD
    promotion_criteria_json nvarchar(max) NULL,
    criteria_configured_by_account_id uniqueidentifier NULL,
    criteria_configured_at_utc datetime2(3) NULL;

ALTER TABLE [C_training].program_version ADD
    CONSTRAINT FK_program_version_criteria_actor FOREIGN KEY (criteria_configured_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT CK_program_version_criteria_json CHECK (promotion_criteria_json IS NULL OR ISJSON(promotion_criteria_json)=1),
    CONSTRAINT CK_program_version_criteria_shape CHECK ((promotion_criteria_json IS NULL AND criteria_configured_by_account_id IS NULL AND criteria_configured_at_utc IS NULL) OR (promotion_criteria_json IS NOT NULL AND criteria_configured_by_account_id IS NOT NULL AND criteria_configured_at_utc IS NOT NULL));

CREATE TABLE [C_training].promotion_decision (
    promotion_decision_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    enrollment_id uniqueidentifier NOT NULL,
    membership_id uniqueidentifier NOT NULL,
    outcome varchar(20) NOT NULL,
    criteria_snapshot_json nvarchar(max) NOT NULL,
    evidence_json nvarchar(max) NOT NULL,
    reason nvarchar(1000) NOT NULL,
    decided_by_account_id uniqueidentifier NOT NULL,
    actor_access_assignment_id uniqueidentifier NOT NULL,
    decided_at_utc datetime2(3) NOT NULL,
    CONSTRAINT PK_promotion_decision PRIMARY KEY (promotion_decision_id),
    CONSTRAINT UQ_promotion_decision_tenant_id UNIQUE (tenant_id,promotion_decision_id),
    CONSTRAINT FK_promotion_decision_enrollment FOREIGN KEY (tenant_id,club_id,enrollment_id) REFERENCES [C_training].enrollment(tenant_id,club_id,enrollment_id),
    CONSTRAINT FK_promotion_decision_membership FOREIGN KEY (tenant_id,club_id,membership_id) REFERENCES [C_membership].club_membership(tenant_id,club_id,membership_id),
    CONSTRAINT FK_promotion_decision_actor FOREIGN KEY (tenant_id,decided_by_account_id,actor_access_assignment_id) REFERENCES [C_authorization].access_assignment(tenant_id,account_id,access_assignment_id),
    CONSTRAINT CK_promotion_decision_outcome CHECK (outcome IN ('APPROVED','REJECTED')),
    CONSTRAINT CK_promotion_decision_reason CHECK (LEN(LTRIM(RTRIM(reason)))>0),
    CONSTRAINT CK_promotion_decision_snapshot CHECK (ISJSON(criteria_snapshot_json)=1),
    CONSTRAINT CK_promotion_decision_evidence CHECK (ISJSON(evidence_json)=1)
);

CREATE TABLE [C_membership].experience_recognition (
    experience_recognition_id uniqueidentifier NOT NULL,
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    membership_id uniqueidentifier NOT NULL,
    outcome varchar(20) NOT NULL,
    experience_summary nvarchar(2000) NOT NULL,
    evidence_json nvarchar(max) NOT NULL,
    reason nvarchar(1000) NOT NULL,
    decided_by_account_id uniqueidentifier NOT NULL,
    actor_access_assignment_id uniqueidentifier NOT NULL,
    decided_at_utc datetime2(3) NOT NULL,
    CONSTRAINT PK_experience_recognition PRIMARY KEY (experience_recognition_id),
    CONSTRAINT UQ_experience_recognition_tenant_id UNIQUE (tenant_id,experience_recognition_id),
    CONSTRAINT FK_experience_recognition_membership FOREIGN KEY (tenant_id,club_id,membership_id) REFERENCES [C_membership].club_membership(tenant_id,club_id,membership_id),
    CONSTRAINT FK_experience_recognition_actor FOREIGN KEY (tenant_id,decided_by_account_id,actor_access_assignment_id) REFERENCES [C_authorization].access_assignment(tenant_id,account_id,access_assignment_id),
    CONSTRAINT CK_experience_recognition_outcome CHECK (outcome IN ('APPROVED','REJECTED')),
    CONSTRAINT CK_experience_recognition_summary CHECK (LEN(LTRIM(RTRIM(experience_summary)))>0),
    CONSTRAINT CK_experience_recognition_reason CHECK (LEN(LTRIM(RTRIM(reason)))>0),
    CONSTRAINT CK_experience_recognition_evidence CHECK (ISJSON(evidence_json)=1)
);

CREATE INDEX IX_promotion_decision_membership_date ON [C_training].promotion_decision(tenant_id,membership_id,decided_at_utc DESC);
CREATE INDEX IX_experience_recognition_membership_date ON [C_membership].experience_recognition(tenant_id,membership_id,decided_at_utc DESC);

IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code='training.promotion.decide')
    INSERT INTO [C_authorization].permission(permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A06','training.promotion.decide',N'Decidir promoción por capacitación','TRAINING','ACTIVE');
IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code='membership.experience-recognition.decide')
    INSERT INTO [C_authorization].permission(permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A07','membership.experience-recognition.decide',N'Decidir reconocimiento por experiencia','MEMBERSHIP','ACTIVE');
IF NOT EXISTS (SELECT 1 FROM [C_authorization].permission WHERE code='membership.transition-history.read')
    INSERT INTO [C_authorization].permission(permission_id,code,name,module,status) VALUES ('AA3189A2-53B2-4CC5-9B35-1F0E81192A08','membership.transition-history.read',N'Consultar historial de transición','MEMBERSHIP','ACTIVE');

COMMIT TRANSACTION;
