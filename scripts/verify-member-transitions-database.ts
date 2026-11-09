import "dotenv/config";
import {randomUUID} from "node:crypto";

import {MemberTransitionService} from "../src/modules/training/application/member-transition-service.js";
import {MssqlMemberTransitionStore} from "../src/modules/training/infrastructure/mssql-member-transition-store.js";
import {createConnectionPool} from "../src/shared/infrastructure/database/connection-pool.js";
import {loadDatabaseConfig} from "../src/shared/infrastructure/database/database-config.js";

const pool=createConnectionPool(loadDatabaseConfig()); await pool.connect();
const ids={tenant:randomUUID(),institution:randomUUID(),club:randomUUID(),admin:randomUUID(),outsider:randomUUID(),role:randomUUID(),personA:randomUUID(),personB:randomUUID(),membershipA:randomUUID(),membershipB:randomUUID(),initialA:randomUUID(),initialB:randomUUID(),program:randomUUID(),version:randomUUID(),session:randomUUID(),enrollment:randomUUID(),attendance:randomUUID()}; const suffix=randomUUID();
const service=new MemberTransitionService(new MssqlMemberTransitionStore(pool));
try{
  await pool.request().input("tenant",ids.tenant).input("institution",ids.institution).input("club",ids.club).input("admin",ids.admin).input("outsider",ids.outsider).input("role",ids.role).input("personA",ids.personA).input("personB",ids.personB).input("membershipA",ids.membershipA).input("membershipB",ids.membershipB).input("initialA",ids.initialA).input("initialB",ids.initialB).input("program",ids.program).input("version",ids.version).input("session",ids.session).input("enrollment",ids.enrollment).input("attendance",ids.attendance).input("tenantCode",`TRANS-${suffix}`).input("adminEmail",`transition-admin-${suffix}@example.invalid`).input("outsiderEmail",`transition-outsider-${suffix}@example.invalid`).query(`
    INSERT INTO [C_platform].tenant(tenant_id,code,display_name,service_status,activated_at_utc) VALUES(@tenant,@tenantCode,N'Transition verification','ACTIVE',SYSUTCDATETIME());
    INSERT INTO [C_organization].institution(institution_id,tenant_id,code,legal_name,display_name,time_zone_id,status) VALUES(@institution,@tenant,'TRANS',N'Transition verification',N'Institución transición','America/Mexico_City','ACTIVE');
    INSERT INTO [C_organization].club(club_id,tenant_id,institution_id,code,name,status) VALUES(@club,@tenant,@institution,'TRANS',N'Club transición','ACTIVE');
    INSERT INTO [C_identity].account(account_id,email_normalized,status,email_verified_at_utc) VALUES(@admin,@adminEmail,'ACTIVE',SYSUTCDATETIME()),(@outsider,@outsiderEmail,'ACTIVE',SYSUTCDATETIME());
    INSERT INTO [C_identity].person(person_id,tenant_id,given_names,family_name) VALUES(@personA,@tenant,N'Aspirante',N'Capacitación'),(@personB,@tenant,N'Aspirante',N'Experiencia');
    INSERT INTO [C_membership].club_membership(membership_id,tenant_id,club_id,person_id,membership_status,member_condition) VALUES(@membershipA,@tenant,@club,@personA,'ACTIVE','ASPIRANT'),(@membershipB,@tenant,@club,@personB,'ACTIVE','ASPIRANT');
    INSERT INTO [C_membership].condition_event(condition_event_id,tenant_id,club_id,membership_id,previous_condition,new_condition,transition_method) VALUES(@initialA,@tenant,@club,@membershipA,NULL,'ASPIRANT','INITIAL_REGISTRATION'),(@initialB,@tenant,@club,@membershipB,NULL,'ASPIRANT','INITIAL_REGISTRATION');
    INSERT INTO [C_authorization].role(role_id,code,name,scope_type,status) VALUES(@role,@tenantCode,N'Transition verifier','CLUB','ACTIVE');
    INSERT INTO [C_authorization].role_permission(role_id,permission_id) SELECT @role,permission_id FROM [C_authorization].permission WHERE code IN ('training.program.manage','training.promotion.decide','membership.experience-recognition.decide','membership.transition-history.read');
    INSERT INTO [C_authorization].access_assignment(account_id,role_id,scope_type,tenant_id,club_id,status) VALUES(@admin,@role,'CLUB',@tenant,@club,'ACTIVE');
    INSERT INTO [C_training].training_program(program_id,tenant_id,club_id,code,name,created_by_account_id) VALUES(@program,@tenant,@club,'TRANSITION',N'Programa transición',@admin);
    INSERT INTO [C_training].program_version(program_version_id,tenant_id,club_id,program_id,version_number,label,status,created_by_account_id) VALUES(@version,@tenant,@club,@program,1,N'Versión prueba','ACTIVE',@admin);
    INSERT INTO [C_training].training_session(session_id,tenant_id,club_id,program_version_id,title,starts_at_utc,ends_at_utc,status,created_by_account_id) VALUES(@session,@tenant,@club,@version,N'Sesión',DATEADD(hour,-2,SYSUTCDATETIME()),DATEADD(hour,-1,SYSUTCDATETIME()),'CLOSED',@admin);
    INSERT INTO [C_training].enrollment(enrollment_id,tenant_id,club_id,program_version_id,membership_id,status,enrolled_by_account_id) VALUES(@enrollment,@tenant,@club,@version,@membershipA,'ENROLLED',@admin);
    INSERT INTO [C_training].session_attendance(attendance_id,tenant_id,club_id,session_id,enrollment_id,attendance_status,recorded_by_account_id,recorded_at_utc,updated_at_utc) VALUES(@attendance,@tenant,@club,@session,@enrollment,'PRESENT',@admin,SYSUTCDATETIME(),SYSUTCDATETIME());
  `);
  const correlationId=randomUUID(); const criteriaInput={actorAccountId:ids.admin,programVersionId:ids.version,criteria:{minimumPresentSessions:1,requiredEvidenceCodes:["CERTIFICATE"]},idempotencyKey:`criteria-${suffix}`,correlationId};
  const criteria=await service.configureCriteria(criteriaInput); const criteriaReplay=await service.configureCriteria(criteriaInput);
  let insufficientRejected=false,unauthorizedRejected=false;
  try{await service.decidePromotion({actorAccountId:ids.admin,enrollmentId:ids.enrollment,outcome:"APPROVED",reason:"Falta evidencia",evidence:[{code:"OTHER",reference:"doc:x"}],idempotencyKey:`insufficient-${suffix}`,correlationId});}catch(error){insufficientRejected=(error as {code?:string}).code==="PROMOTION_NOT_ELIGIBLE";}
  try{await service.decidePromotion({actorAccountId:ids.outsider,enrollmentId:ids.enrollment,outcome:"APPROVED",reason:"No autorizado",evidence:[{code:"CERTIFICATE",reference:"doc:x"}],idempotencyKey:`unauthorized-${suffix}`,correlationId});}catch(error){unauthorizedRejected=(error as {code?:string}).code==="MEMBER_TRANSITION_FORBIDDEN";}
  const promotionInput={actorAccountId:ids.admin,enrollmentId:ids.enrollment,outcome:"APPROVED" as const,reason:"Criterios y evidencia aprobados",evidence:[{code:"CERTIFICATE",reference:"doc:certificate"}],idempotencyKey:`promotion-${suffix}`,correlationId};
  const promotion=await service.decidePromotion(promotionInput); const promotionReplay=await service.decidePromotion(promotionInput);
  const recognitionInput={actorAccountId:ids.admin,membershipId:ids.membershipB,outcome:"APPROVED" as const,reason:"Experiencia validada",experienceSummary:"Experiencia previa documentada",evidence:[{code:"LETTER",reference:"doc:letter"}],idempotencyKey:`recognition-${suffix}`,correlationId};
  const recognition=await service.decideExperienceRecognition(recognitionInput); const recognitionReplay=await service.decideExperienceRecognition(recognitionInput);
  const history=await service.getHistory(ids.admin,ids.membershipA);
  const state=await pool.request().input("a",ids.membershipA).input("b",ids.membershipB).query<{conditionA:string;conditionB:string;trainingEvents:number;recognitionEvents:number;recognitionAttendances:number;criteriaSnapshot:string}>(`
    SELECT (SELECT member_condition FROM [C_membership].club_membership WHERE membership_id=@a) AS conditionA,(SELECT member_condition FROM [C_membership].club_membership WHERE membership_id=@b) AS conditionB,
      (SELECT COUNT(*) FROM [C_membership].condition_event WHERE membership_id=@a AND transition_method='TRAINING_COMPLETION') AS trainingEvents,
      (SELECT COUNT(*) FROM [C_membership].condition_event WHERE membership_id=@b AND transition_method='PRIOR_EXPERIENCE_RECOGNITION') AS recognitionEvents,
      (SELECT COUNT(*) FROM [C_training].session_attendance sa JOIN [C_training].enrollment e ON e.enrollment_id=sa.enrollment_id WHERE e.membership_id=@b) AS recognitionAttendances,
      (SELECT TOP(1) criteria_snapshot_json FROM [C_training].promotion_decision WHERE membership_id=@a ORDER BY decided_at_utc DESC) AS criteriaSnapshot;
  `); const row=state.recordset[0];
  if(row===undefined||!criteriaReplay.replayed||criteria.replayed||!insufficientRejected||!unauthorizedRejected||promotion.memberCondition!=="COLPORTOR"||!promotionReplay.replayed||recognition.memberCondition!=="COLPORTOR"||!recognitionReplay.replayed||history.events.length!==2||row.conditionA!=="COLPORTOR"||row.conditionB!=="COLPORTOR"||row.trainingEvents!==1||row.recognitionEvents!==1||row.recognitionAttendances!==0||!row.criteriaSnapshot.includes("minimumPresentSessions")) throw new Error("Member transition verification failed");
  process.stdout.write(`${JSON.stringify({criteriaVersioned:true,noGlobalThreshold:true,insufficientEvidenceRejected:true,unauthorizedRejected:true,promotionApproved:true,promotionReplay:true,recognitionApproved:true,recognitionReplay:true,recognitionCreatedAttendance:false,separateConditionEvents:true,auditedHistory:true})}\n`);
}finally{
  try{await pool.request().input("tenant",ids.tenant).input("role",ids.role).input("admin",ids.admin).input("outsider",ids.outsider).query(`
    DELETE FROM [C_audit].audit_event WHERE tenant_id=@tenant; DELETE FROM [C_audit].idempotency_record WHERE tenant_id=@tenant;
    DELETE FROM [C_membership].condition_event WHERE tenant_id=@tenant AND transition_method<>'INITIAL_REGISTRATION';
    DELETE FROM [C_training].promotion_decision WHERE tenant_id=@tenant; DELETE FROM [C_membership].experience_recognition WHERE tenant_id=@tenant;
    DELETE FROM [C_training].session_attendance WHERE tenant_id=@tenant; DELETE FROM [C_training].enrollment WHERE tenant_id=@tenant; DELETE FROM [C_training].training_session WHERE tenant_id=@tenant; DELETE FROM [C_training].program_version WHERE tenant_id=@tenant; DELETE FROM [C_training].training_program WHERE tenant_id=@tenant;
    DELETE FROM [C_membership].condition_event WHERE tenant_id=@tenant; DELETE FROM [C_membership].club_membership WHERE tenant_id=@tenant; DELETE FROM [C_identity].person WHERE tenant_id=@tenant;
    DELETE FROM [C_authorization].access_assignment WHERE tenant_id=@tenant; DELETE FROM [C_authorization].role_permission WHERE role_id=@role; DELETE FROM [C_authorization].role WHERE role_id=@role;
    DELETE FROM [C_identity].account WHERE account_id IN(@admin,@outsider); DELETE FROM [C_organization].club WHERE tenant_id=@tenant; DELETE FROM [C_organization].institution WHERE tenant_id=@tenant; DELETE FROM [C_platform].tenant WHERE tenant_id=@tenant;
  `);
  const cleanup=await pool.request().input("tenant",ids.tenant).query<{remaining:number}>(`SELECT (SELECT COUNT(*) FROM [C_training].promotion_decision WHERE tenant_id=@tenant)+(SELECT COUNT(*) FROM [C_membership].experience_recognition WHERE tenant_id=@tenant)+(SELECT COUNT(*) FROM [C_membership].condition_event WHERE tenant_id=@tenant)+(SELECT COUNT(*) FROM [C_audit].idempotency_record WHERE tenant_id=@tenant) AS remaining;`);
  if(cleanup.recordset[0]?.remaining!==0){process.stderr.write("Member transition verification fixtures were not cleaned\n");process.exitCode=1;}
  }finally{await pool.close();}
}
