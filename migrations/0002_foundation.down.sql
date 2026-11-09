SET XACT_ABORT ON;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS [C_audit].idempotency_record;
DROP TABLE IF EXISTS [C_audit].audit_event;
DROP TABLE IF EXISTS [C_platform].tenant_service_state_event;
DROP TABLE IF EXISTS [C_identity].action_token;
DROP TABLE IF EXISTS [C_organization].position_assignment;
DROP TABLE IF EXISTS [C_organization].club_position;
DROP TABLE IF EXISTS [C_membership].condition_event;
DROP TABLE IF EXISTS [C_authorization].access_assignment;
DROP TABLE IF EXISTS [C_authorization].role_permission;
DROP TABLE IF EXISTS [C_authorization].permission;
DROP TABLE IF EXISTS [C_authorization].role;
DROP TABLE IF EXISTS [C_membership].club_membership;
DROP TABLE IF EXISTS [C_identity].account_person_link;
DROP TABLE IF EXISTS [C_identity].person;
DROP TABLE IF EXISTS [C_identity].account;
DROP TABLE IF EXISTS [C_organization].club;
DROP TABLE IF EXISTS [C_organization].institution;
DROP TABLE IF EXISTS [C_platform].tenant;

COMMIT TRANSACTION;
