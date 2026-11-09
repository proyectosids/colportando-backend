import "dotenv/config";

import { randomUUID } from "node:crypto";

import { TrainingService } from "../src/modules/training/application/training-service.js";
import { MssqlTrainingStore } from "../src/modules/training/infrastructure/mssql-training-store.js";
import { createConnectionPool } from "../src/shared/infrastructure/database/connection-pool.js";
import { loadDatabaseConfig } from "../src/shared/infrastructure/database/database-config.js";

async function main(): Promise<void> {
  const pool = createConnectionPool(loadDatabaseConfig()); await pool.connect();
  const tenantId=randomUUID(), institutionId=randomUUID(), clubId=randomUUID(), adminId=randomUUID(), aspirantAccountId=randomUUID(), outsiderAccountId=randomUUID(), personId=randomUUID(), membershipId=randomUUID(), conditionEventId=randomUUID(), linkId=randomUUID(), roleId=randomUUID(), suffix=randomUUID();
  const service=new TrainingService(new MssqlTrainingStore(pool),()=>new Date());
  try {
    await pool.request().input("tenant",tenantId).input("institution",institutionId).input("club",clubId).input("admin",adminId).input("aspirant",aspirantAccountId).input("outsider",outsiderAccountId).input("person",personId).input("membership",membershipId).input("event",conditionEventId).input("link",linkId).input("role",roleId).input("tenantCode",`TRAIN-${suffix}`).input("adminEmail",`training-admin-${suffix}@example.invalid`).input("aspirantEmail",`training-aspirant-${suffix}@example.invalid`).input("outsiderEmail",`training-outsider-${suffix}@example.invalid`).query(`
      INSERT INTO [C_platform].tenant (tenant_id,code,display_name,service_status,activated_at_utc) VALUES (@tenant,@tenantCode,N'Training verification','ACTIVE',SYSUTCDATETIME());
      INSERT INTO [C_organization].institution (institution_id,tenant_id,code,legal_name,display_name,time_zone_id,status) VALUES (@institution,@tenant,'TRAIN',N'Training verification',N'Institución de prueba','America/Mexico_City','ACTIVE');
      INSERT INTO [C_organization].club (club_id,tenant_id,institution_id,code,name,status) VALUES (@club,@tenant,@institution,'TRAIN',N'Club de capacitación','ACTIVE');
      INSERT INTO [C_identity].account (account_id,email_normalized,status,email_verified_at_utc) VALUES (@admin,@adminEmail,'ACTIVE',SYSUTCDATETIME()),(@aspirant,@aspirantEmail,'ACTIVE',SYSUTCDATETIME()),(@outsider,@outsiderEmail,'ACTIVE',SYSUTCDATETIME());
      INSERT INTO [C_identity].person (person_id,tenant_id,given_names,family_name,contact_email_normalized) VALUES (@person,@tenant,N'Persona',N'Aspirante',@aspirantEmail);
      INSERT INTO [C_identity].account_person_link (account_person_link_id,tenant_id,account_id,person_id,status) VALUES (@link,@tenant,@aspirant,@person,'ACTIVE');
      INSERT INTO [C_membership].club_membership (membership_id,tenant_id,club_id,person_id,membership_status,member_condition) VALUES (@membership,@tenant,@club,@person,'ACTIVE','ASPIRANT');
      INSERT INTO [C_membership].condition_event (condition_event_id,tenant_id,club_id,membership_id,previous_condition,new_condition,transition_method) VALUES (@event,@tenant,@club,@membership,NULL,'ASPIRANT','INITIAL_REGISTRATION');
      INSERT INTO [C_authorization].role (role_id,code,name,scope_type,status) VALUES (@role,@tenantCode,N'Training verifier','CLUB','ACTIVE');
      INSERT INTO [C_authorization].role_permission (role_id,permission_id) SELECT @role,permission_id FROM [C_authorization].permission WHERE code IN ('training.program.manage','training.session.manage','training.enrollment.manage','training.attendance.record','training.progress.read');
      INSERT INTO [C_authorization].access_assignment (account_id,role_id,scope_type,tenant_id,club_id,status) VALUES (@admin,@role,'CLUB',@tenant,@club,'ACTIVE');
    `);

    const programInput={actorAccountId:adminId,clubId,code:"BASIC",name:"Formación básica",versionLabel:"2026",idempotencyKey:`program-${suffix}`,correlationId:randomUUID()};
    const program=await service.createProgram(programInput); const programReplay=await service.createProgram(programInput); const versionId=program.programVersionId;
    const startsAt=new Date(Date.now()-3_600_000), endsAt=new Date(Date.now()+3_600_000);
    const sessionInput={actorAccountId:adminId,programVersionId:versionId,title:"Sesión de prueba",startsAt,endsAt,idempotencyKey:`session-${suffix}`,correlationId:randomUUID()};
    const session=await service.createSession(sessionInput); const sessionReplay=await service.createSession(sessionInput); const sessionId=session.sessionId;
    const enrollmentInput={actorAccountId:adminId,programVersionId:versionId,membershipId,idempotencyKey:`enroll-${suffix}`,correlationId:randomUUID()};
    const enrollment=await service.enroll(enrollmentInput); const enrollmentReplay=await service.enroll(enrollmentInput); const enrollmentId=enrollment.enrollmentId;
    const attendanceInput={actorAccountId:adminId,sessionId,enrollmentId,attendanceStatus:"PRESENT" as const,idempotencyKey:`attendance-${suffix}`,correlationId:randomUUID()};
    const attendance=await service.recordAttendance(attendanceInput); const attendanceReplay=await service.recordAttendance(attendanceInput);
    const closeInput={actorAccountId:adminId,sessionId,status:"CLOSED" as const,idempotencyKey:`close-${suffix}`,correlationId:randomUUID()};
    const closed=await service.changeSessionStatus(closeInput); const closeReplay=await service.changeSessionStatus(closeInput);
    let closedAttendanceRejected=false;
    try { await service.recordAttendance({ ...attendanceInput,idempotencyKey:`attendance-closed-${suffix}` }); }
    catch(error) { closedAttendanceRejected=(error as { code?: string }).code==="TRAINING_SESSION_CLOSED"; }
    const progress=await service.getProgress(aspirantAccountId,enrollmentId);
    let unauthorizedWriteRejected=false, unauthorizedReadRejected=false;
    try { await service.createProgram({ ...programInput,actorAccountId:aspirantAccountId,code:"DENIED",idempotencyKey:`denied-${suffix}` }); }
    catch(error) { unauthorizedWriteRejected=(error as { code?: string }).code==="TRAINING_PROGRAM_FORBIDDEN"; }
    try { await service.getProgress(outsiderAccountId,enrollmentId); }
    catch(error) { unauthorizedReadRejected=(error as { code?: string }).code==="TRAINING_PROGRESS_FORBIDDEN"; }
    const condition=await pool.request().input("membership",membershipId).query<{ memberCondition:string; eventCount:number }>(`SELECT member_condition AS memberCondition,(SELECT COUNT(*) FROM [C_membership].condition_event WHERE membership_id=@membership) AS eventCount FROM [C_membership].club_membership WHERE membership_id=@membership;`);
    const row=condition.recordset[0];
    if(row===undefined||!programReplay.replayed||!sessionReplay.replayed||!enrollmentReplay.replayed||!attendanceReplay.replayed||attendance.replayed||closed.status!=="CLOSED"||!closeReplay.replayed||!closedAttendanceRejected||!unauthorizedWriteRejected||!unauthorizedReadRejected||progress.attendanceRate!==100||row.memberCondition!=="ASPIRANT"||row.eventCount!==1) throw new Error("Training verification invariant failed");
    process.stdout.write(`${JSON.stringify({programVersioned:true,programReplay:true,sessionReplay:true,enrollmentReplay:true,attendanceReplay:true,sessionClosed:true,closedAttendanceRejected:true,unauthorizedWriteRejected:true,unauthorizedReadRejected:true,selfProgress:true,attendanceRate:progress.attendanceRate,automaticPromotion:false,memberCondition:row.memberCondition})}\n`);
  } finally {
    try {
      await pool.request().input("tenant",tenantId).input("admin",adminId).input("aspirant",aspirantAccountId).input("outsider",outsiderAccountId).input("role",roleId).query(`
        DELETE FROM [C_audit].audit_event WHERE tenant_id=@tenant;
        DELETE FROM [C_audit].idempotency_record WHERE tenant_id=@tenant;
        DELETE FROM [C_training].session_attendance WHERE tenant_id=@tenant;
        DELETE FROM [C_training].enrollment WHERE tenant_id=@tenant;
        DELETE FROM [C_training].training_session WHERE tenant_id=@tenant;
        DELETE FROM [C_training].program_version WHERE tenant_id=@tenant;
        DELETE FROM [C_training].training_program WHERE tenant_id=@tenant;
        DELETE FROM [C_membership].condition_event WHERE tenant_id=@tenant;
        DELETE FROM [C_membership].club_membership WHERE tenant_id=@tenant;
        DELETE FROM [C_identity].account_person_link WHERE tenant_id=@tenant;
        DELETE FROM [C_identity].person WHERE tenant_id=@tenant;
        DELETE FROM [C_authorization].access_assignment WHERE tenant_id=@tenant OR account_id IN (@admin,@aspirant,@outsider);
        DELETE FROM [C_authorization].role_permission WHERE role_id=@role;
        DELETE FROM [C_authorization].role WHERE role_id=@role;
        DELETE FROM [C_identity].account WHERE account_id IN (@admin,@aspirant,@outsider);
        DELETE FROM [C_organization].club WHERE tenant_id=@tenant;
        DELETE FROM [C_organization].institution WHERE tenant_id=@tenant;
        DELETE FROM [C_platform].tenant WHERE tenant_id=@tenant;
      `);
      const cleanup=await pool.request().input("tenant",tenantId).query<{ remaining:number }>(`
        SELECT
          (SELECT COUNT(*) FROM [C_training].session_attendance WHERE tenant_id=@tenant)
          +(SELECT COUNT(*) FROM [C_training].enrollment WHERE tenant_id=@tenant)
          +(SELECT COUNT(*) FROM [C_training].training_session WHERE tenant_id=@tenant)
          +(SELECT COUNT(*) FROM [C_training].program_version WHERE tenant_id=@tenant)
          +(SELECT COUNT(*) FROM [C_training].training_program WHERE tenant_id=@tenant) AS remaining;
      `);
      if(cleanup.recordset[0]?.remaining!==0) {
        process.stderr.write("Training verification fixtures were not cleaned\n");
        process.exitCode=1;
      }
    } finally { await pool.close(); }
  }
}

await main();
