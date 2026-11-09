import "dotenv/config";

import { randomUUID } from "node:crypto";
import sql from "mssql";

import { ArgonPasswordHasher } from "../src/modules/auth/infrastructure/argon-password-hasher.js";
import { createConnectionPool } from "../src/shared/infrastructure/database/connection-pool.js";
import { loadDatabaseConfig } from "../src/shared/infrastructure/database/database-config.js";

const required = (name: string): string => { const value = process.env[name]?.trim(); if (value === undefined || value === "") throw new Error(`${name} is required for one-time administrator bootstrap`); return value; };
const tenantCode = required("BOOTSTRAP_TENANT_CODE").toUpperCase();
const institutionCode = required("BOOTSTRAP_INSTITUTION_CODE").toUpperCase();
const institutionName = required("BOOTSTRAP_INSTITUTION_NAME");
const clubCode = required("BOOTSTRAP_CLUB_CODE").toUpperCase();
const clubName = required("BOOTSTRAP_CLUB_NAME");
const adminEmail = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const adminPassword = required("BOOTSTRAP_ADMIN_PASSWORD");
const timeZone = required("BOOTSTRAP_TIME_ZONE");
if (adminPassword.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");

const pool = createConnectionPool(loadDatabaseConfig());
await pool.connect();
const transaction = new sql.Transaction(pool);
await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
try {
  const request = () => new sql.Request(transaction);
  let tenant = (await request().input("code", tenantCode).query<{ tenantId: string }>(`SELECT tenant_id AS tenantId FROM [C_platform].tenant WITH(UPDLOCK,HOLDLOCK) WHERE code=@code;`)).recordset[0];
  if (tenant === undefined) {
    tenant = { tenantId: randomUUID() };
    await request().input("id", tenant.tenantId).input("code", tenantCode).input("name", institutionName).query(`INSERT INTO [C_platform].tenant(tenant_id,code,display_name,tenant_type,service_status,activated_at_utc)VALUES(@id,@code,@name,'INSTITUTION','ACTIVE',SYSUTCDATETIME());`);
  }
  let institution = (await request().input("tenant", tenant.tenantId).query<{ institutionId: string }>(`SELECT institution_id AS institutionId FROM [C_organization].institution WITH(UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenant;`)).recordset[0];
  if (institution === undefined) {
    institution = { institutionId: randomUUID() };
    await request().input("id", institution.institutionId).input("tenant", tenant.tenantId).input("code", institutionCode).input("name", institutionName).input("timeZone", timeZone).query(`INSERT INTO [C_organization].institution(institution_id,tenant_id,code,legal_name,display_name,time_zone_id,status)VALUES(@id,@tenant,@code,@name,@name,@timeZone,'ACTIVE');`);
  }
  let club = (await request().input("tenant", tenant.tenantId).input("code", clubCode).query<{ clubId: string }>(`SELECT club_id AS clubId FROM [C_organization].club WITH(UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenant AND code=@code;`)).recordset[0];
  if (club === undefined) {
    club = { clubId: randomUUID() };
    await request().input("id", club.clubId).input("tenant", tenant.tenantId).input("institution", institution.institutionId).input("code", clubCode).input("name", clubName).query(`INSERT INTO [C_organization].club(club_id,tenant_id,institution_id,code,name,status)VALUES(@id,@tenant,@institution,@code,@name,'ACTIVE');`);
  }
  let account = (await request().input("email", adminEmail).query<{ accountId: string }>(`SELECT account_id AS accountId FROM [C_identity].account WITH(UPDLOCK,HOLDLOCK) WHERE email_normalized=@email;`)).recordset[0];
  if (account === undefined) {
    account = { accountId: randomUUID() };
    const passwordHash = await new ArgonPasswordHasher().hash(adminPassword);
    await request().input("id", account.accountId).input("email", adminEmail).input("hash", passwordHash).query(`INSERT INTO [C_identity].account(account_id,email_normalized,password_hash,status,email_verified_at_utc,password_changed_at_utc)VALUES(@id,@email,@hash,'ACTIVE',SYSUTCDATETIME(),SYSUTCDATETIME());`);
  }
  const role = (await request().query<{ roleId: string }>(`SELECT role_id AS roleId FROM [C_authorization].role WHERE code='INSTITUTION_ADMIN' AND scope_type='INSTITUTION' AND status='ACTIVE';`)).recordset[0];
  if (role === undefined) throw new Error("Migration 0008 must be applied before administrator bootstrap");
  const assigned = (await request().input("account", account.accountId).input("role", role.roleId).input("tenant", tenant.tenantId).input("institution", institution.institutionId).query(`SELECT 1 FROM [C_authorization].access_assignment WHERE account_id=@account AND role_id=@role AND tenant_id=@tenant AND institution_id=@institution AND status='ACTIVE';`)).recordset.length > 0;
  if (!assigned) await request().input("id", randomUUID()).input("account", account.accountId).input("role", role.roleId).input("tenant", tenant.tenantId).input("institution", institution.institutionId).query(`INSERT INTO [C_authorization].access_assignment(access_assignment_id,account_id,role_id,scope_type,tenant_id,institution_id,status,reason)VALUES(@id,@account,@role,'INSTITUTION',@tenant,@institution,'ACTIVE',N'One-time controlled bootstrap');`);
  await transaction.commit();
  process.stdout.write(`${JSON.stringify({ tenantId: tenant.tenantId, institutionId: institution.institutionId, clubId: club.clubId, accountId: account.accountId, role: "INSTITUTION_ADMIN", alreadyAssigned: assigned })}\n`);
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
