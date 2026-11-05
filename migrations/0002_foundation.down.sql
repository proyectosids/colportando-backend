SET XACT_ABORT ON;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS audit.idempotency_record;
DROP TABLE IF EXISTS audit.audit_event;
DROP TABLE IF EXISTS platform.tenant_service_state_event;
DROP TABLE IF EXISTS identity.action_token;
DROP TABLE IF EXISTS organization.position_assignment;
DROP TABLE IF EXISTS organization.club_position;
DROP TABLE IF EXISTS membership.condition_event;
DROP TABLE IF EXISTS [authorization].access_assignment;
DROP TABLE IF EXISTS [authorization].role_permission;
DROP TABLE IF EXISTS [authorization].permission;
DROP TABLE IF EXISTS [authorization].role;
DROP TABLE IF EXISTS membership.club_membership;
DROP TABLE IF EXISTS identity.account_person_link;
DROP TABLE IF EXISTS identity.person;
DROP TABLE IF EXISTS identity.account;
DROP TABLE IF EXISTS organization.club;
DROP TABLE IF EXISTS organization.institution;
DROP TABLE IF EXISTS platform.tenant;

COMMIT TRANSACTION;
