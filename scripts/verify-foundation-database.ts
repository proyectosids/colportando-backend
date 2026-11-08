import "dotenv/config";

import sql from "mssql";

import { createConnectionPool } from "../src/shared/infrastructure/database/connection-pool.js";
import { loadDatabaseConfig } from "../src/shared/infrastructure/database/database-config.js";

type VerificationResult = Readonly<{
  crossTenantClubRejected: boolean;
  crossTenantMembershipRejected: boolean;
  crossTenantAccessRejected: boolean;
  adminWithoutMembershipAccepted: boolean;
  defaultCondition: string;
  invalidInitialConditionRejected: boolean;
}>;

const verificationSql = `
SET NOCOUNT ON;
SET XACT_ABORT OFF;

DECLARE @tenant_a uniqueidentifier = NEWID();
DECLARE @tenant_b uniqueidentifier = NEWID();
DECLARE @institution_a uniqueidentifier = NEWID();
DECLARE @institution_b uniqueidentifier = NEWID();
DECLARE @club_a uniqueidentifier = NEWID();
DECLARE @person_a uniqueidentifier = NEWID();
DECLARE @person_b uniqueidentifier = NEWID();
DECLARE @membership_a uniqueidentifier = NEWID();
DECLARE @account_id uniqueidentifier = NEWID();
DECLARE @role_id uniqueidentifier = NEWID();

DECLARE @cross_tenant_club_rejected bit = 0;
DECLARE @cross_tenant_membership_rejected bit = 0;
DECLARE @cross_tenant_access_rejected bit = 0;
DECLARE @invalid_initial_condition_rejected bit = 0;

INSERT INTO platform.tenant (tenant_id, code, display_name)
VALUES
  (@tenant_a, CONCAT('VERIFY-A-', CONVERT(varchar(36), NEWID())), N'Verification tenant A'),
  (@tenant_b, CONCAT('VERIFY-B-', CONVERT(varchar(36), NEWID())), N'Verification tenant B');

INSERT INTO organization.institution
  (institution_id, tenant_id, code, legal_name, display_name, time_zone_id)
VALUES
  (@institution_a, @tenant_a, 'VERIFY-A', N'Verification A', N'Verification A', 'UTC'),
  (@institution_b, @tenant_b, 'VERIFY-B', N'Verification B', N'Verification B', 'UTC');

INSERT INTO organization.club (club_id, tenant_id, institution_id, code, name)
VALUES (@club_a, @tenant_a, @institution_a, 'VERIFY-A', N'Verification club A');

BEGIN TRY
  INSERT INTO organization.club (tenant_id, institution_id, code, name)
  VALUES (@tenant_a, @institution_b, 'INVALID-CROSS-TENANT', N'Invalid cross-tenant club');
END TRY
BEGIN CATCH
  SET @cross_tenant_club_rejected = 1;
END CATCH;

INSERT INTO [identity].person (person_id, tenant_id, given_names, family_name)
VALUES
  (@person_a, @tenant_a, N'Verification', N'Person A'),
  (@person_b, @tenant_b, N'Verification', N'Person B');

BEGIN TRY
  INSERT INTO membership.club_membership (tenant_id, club_id, person_id)
  VALUES (@tenant_a, @club_a, @person_b);
END TRY
BEGIN CATCH
  SET @cross_tenant_membership_rejected = 1;
END CATCH;

INSERT INTO membership.club_membership (membership_id, tenant_id, club_id, person_id)
VALUES (@membership_a, @tenant_a, @club_a, @person_a);

INSERT INTO [identity].account (account_id, email_normalized)
VALUES (@account_id, CONCAT('verify-', CONVERT(varchar(36), NEWID()), '@example.invalid'));

INSERT INTO [authorization].role (role_id, code, name, scope_type)
VALUES (@role_id, CONCAT('VERIFY-', CONVERT(varchar(36), NEWID())), N'Verification role', 'CLUB');

BEGIN TRY
  INSERT INTO [authorization].access_assignment
    (account_id, role_id, scope_type, tenant_id, club_id)
  VALUES (@account_id, @role_id, 'CLUB', @tenant_b, @club_a);
END TRY
BEGIN CATCH
  SET @cross_tenant_access_rejected = 1;
END CATCH;

BEGIN TRY
  INSERT INTO membership.condition_event
    (tenant_id, club_id, membership_id, previous_condition, new_condition, transition_method)
  VALUES (@tenant_a, @club_a, @membership_a, NULL, 'COLPORTOR', 'INITIAL_REGISTRATION');
END TRY
BEGIN CATCH
  SET @invalid_initial_condition_rejected = 1;
END CATCH;

SELECT
  @cross_tenant_club_rejected AS crossTenantClubRejected,
  @cross_tenant_membership_rejected AS crossTenantMembershipRejected,
  @cross_tenant_access_rejected AS crossTenantAccessRejected,
  CONVERT(bit, CASE
    WHEN EXISTS (SELECT 1 FROM [identity].account WHERE account_id = @account_id)
      AND NOT EXISTS (
        SELECT 1
        FROM [identity].account_person_link AS link
        INNER JOIN membership.club_membership AS membership
          ON membership.tenant_id = link.tenant_id
          AND membership.person_id = link.person_id
        WHERE link.account_id = @account_id
      )
    THEN 1 ELSE 0
  END) AS adminWithoutMembershipAccepted,
  (SELECT member_condition FROM membership.club_membership WHERE membership_id = @membership_a) AS defaultCondition,
  @invalid_initial_condition_rejected AS invalidInitialConditionRejected;
`;

function assertVerified(result: VerificationResult): void {
  const allExpectedFailuresOccurred =
    result.crossTenantClubRejected &&
    result.crossTenantMembershipRejected &&
    result.crossTenantAccessRejected &&
    result.invalidInitialConditionRejected;

  if (!allExpectedFailuresOccurred || !result.adminWithoutMembershipAccepted) {
    throw new Error("One or more foundation database invariants were not enforced");
  }

  if (result.defaultCondition !== "ASPIRANT") {
    throw new Error(`Expected default membership condition ASPIRANT, got ${result.defaultCondition}`);
  }
}

async function main(): Promise<void> {
  const pool = createConnectionPool(loadDatabaseConfig());
  await pool.connect();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const response = await new sql.Request(transaction).batch<VerificationResult>(verificationSql);
    const result = response.recordset[0];
    if (result === undefined) {
      throw new Error("Foundation database verification returned no result");
    }

    assertVerified(result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await transaction.rollback().catch(() => undefined);
    await pool.close();
  }
}

await main();
