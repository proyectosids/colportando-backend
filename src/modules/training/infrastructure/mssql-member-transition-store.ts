import { randomUUID } from "node:crypto";

import sql from "mssql";

import { calculateAttendanceRate } from "../domain/training-progress.js";
import { evaluatePromotionCriteria, type PromotionCriteria } from "../domain/promotion-criteria.js";
import type { CriteriaConfigured, ExperienceRecognitionResult, MemberTransitionStore, PromotionDecisionResult, TransitionHistory, TransitionStoreError } from "../application/ports/member-transition-store.js";

type IdempotencyRow=Readonly<{requestHash:Buffer;responseJson:string}>;
type VersionRow=Readonly<{tenantId:string;clubId:string;actorAssignmentId:string|null}>;
type PromotionRow=Readonly<{tenantId:string;clubId:string;membershipId:string;memberCondition:string;criteriaJson:string|null;programId:string;programVersionId:string;versionNumber:number;versionLabel:string;recordedSessions:number;presentSessions:number;actorAssignmentId:string|null}>;
type MembershipRow=Readonly<{tenantId:string;clubId:string;memberCondition:string;actorAssignmentId:string|null}>;
type HistoryEventRow=TransitionHistory["events"][number]&Readonly<{evidenceJson:string|null}>;
type WriteContext=Readonly<{actorAccountId:string;idempotencyKey:string;requestHash:Buffer;subjectHash:Buffer;correlationId:string;now:Date}>;

export class MssqlMemberTransitionStore implements MemberTransitionStore {
  public constructor(private readonly pool:sql.ConnectionPool){}

  public async configureCriteria(input:Parameters<MemberTransitionStore["configureCriteria"]>[0]):Promise<CriteriaConfigured|TransitionStoreError>{
    const transaction=new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try{
      const row=(await new sql.Request(transaction).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("version",sql.UniqueIdentifier,input.programVersionId).query<VersionRow>(`
        SELECT pv.tenant_id AS tenantId,pv.club_id AS clubId,
          (SELECT TOP (1) aa.access_assignment_id FROM [C_authorization].access_assignment aa JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id AND p.code='training.program.manage' AND p.status='ACTIVE' WHERE aa.account_id=@actor AND aa.tenant_id=pv.tenant_id AND aa.status='ACTIVE' AND aa.scope_type IN ('INSTITUTION','CLUB') AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME()) AND (aa.scope_type='INSTITUTION' OR aa.club_id=pv.club_id)) AS actorAssignmentId
        FROM [C_training].program_version pv JOIN [C_training].training_program tp ON tp.tenant_id=pv.tenant_id AND tp.club_id=pv.club_id AND tp.program_id=pv.program_id WHERE pv.program_version_id=@version AND pv.status='ACTIVE' AND tp.status='ACTIVE';
      `)).recordset[0];
      if(row===undefined){await transaction.commit();return "NOT_FOUND";} if(row.actorAssignmentId===null){await transaction.commit();return "FORBIDDEN";}
      const replay=await this.readReplay<CriteriaConfigured>(transaction,row.tenantId,input,"CONFIGURE_PROMOTION_CRITERIA"); if(replay!==null){await transaction.commit();return replay;}
      const criteriaJson=JSON.stringify(input.criteria);
      await new sql.Request(transaction).input("version",sql.UniqueIdentifier,input.programVersionId).input("criteria",sql.NVarChar(sql.MAX),criteriaJson).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("now",sql.DateTime2(3),input.now).query(`UPDATE [C_training].program_version SET promotion_criteria_json=@criteria,criteria_configured_by_account_id=@actor,criteria_configured_at_utc=@now WHERE program_version_id=@version;`);
      const response:CriteriaConfigured={programVersionId:input.programVersionId,criteria:input.criteria,replayed:false}; await this.finish(transaction,row,input,"CONFIGURE_PROMOTION_CRITERIA","PROGRAM_VERSION",input.programVersionId,response); await transaction.commit(); return response;
    }catch(error){await transaction.rollback().catch(()=>undefined);throw error;}
  }

  public async decidePromotion(input:Parameters<MemberTransitionStore["decidePromotion"]>[0]):Promise<PromotionDecisionResult|TransitionStoreError>{
    const transaction=new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try{
      const row=(await new sql.Request(transaction).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("enrollment",sql.UniqueIdentifier,input.enrollmentId).query<PromotionRow>(`
        SELECT e.tenant_id AS tenantId,e.club_id AS clubId,e.membership_id AS membershipId,cm.member_condition AS memberCondition,pv.promotion_criteria_json AS criteriaJson,pv.program_id AS programId,pv.program_version_id AS programVersionId,pv.version_number AS versionNumber,pv.label AS versionLabel,
          (SELECT COUNT(*) FROM [C_training].session_attendance a JOIN [C_training].training_session s ON s.tenant_id=a.tenant_id AND s.session_id=a.session_id AND s.status<>'CANCELLED' WHERE a.tenant_id=e.tenant_id AND a.enrollment_id=e.enrollment_id) AS recordedSessions,
          (SELECT COUNT(*) FROM [C_training].session_attendance a JOIN [C_training].training_session s ON s.tenant_id=a.tenant_id AND s.session_id=a.session_id AND s.status<>'CANCELLED' WHERE a.tenant_id=e.tenant_id AND a.enrollment_id=e.enrollment_id AND a.attendance_status='PRESENT') AS presentSessions,
          (SELECT TOP (1) aa.access_assignment_id FROM [C_authorization].access_assignment aa JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id AND p.code='training.promotion.decide' AND p.status='ACTIVE' WHERE aa.account_id=@actor AND aa.tenant_id=e.tenant_id AND aa.status='ACTIVE' AND aa.scope_type IN ('INSTITUTION','CLUB') AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME()) AND (aa.scope_type='INSTITUTION' OR aa.club_id=e.club_id)) AS actorAssignmentId
        FROM [C_training].enrollment e WITH (UPDLOCK,HOLDLOCK) JOIN [C_training].program_version pv ON pv.tenant_id=e.tenant_id AND pv.club_id=e.club_id AND pv.program_version_id=e.program_version_id JOIN [C_membership].club_membership cm WITH (UPDLOCK,HOLDLOCK) ON cm.tenant_id=e.tenant_id AND cm.club_id=e.club_id AND cm.membership_id=e.membership_id WHERE e.enrollment_id=@enrollment AND e.status='ENROLLED';
      `)).recordset[0];
      if(row===undefined){await transaction.commit();return "NOT_FOUND";} if(row.actorAssignmentId===null){await transaction.commit();return "FORBIDDEN";}
      const replay=await this.readReplay<PromotionDecisionResult>(transaction,row.tenantId,input,"DECIDE_TRAINING_PROMOTION"); if(replay!==null){await transaction.commit();return replay;}
      if(row.memberCondition!=="ASPIRANT"){await transaction.commit();return "CONFLICT";} if(row.criteriaJson===null){await transaction.commit();return "CRITERIA_NOT_CONFIGURED";}
      const criteria=JSON.parse(row.criteriaJson) as PromotionCriteria; const attendanceRate=calculateAttendanceRate(row.presentSessions,row.recordedSessions); const evaluation=evaluatePromotionCriteria(criteria,{recordedSessions:row.recordedSessions,presentSessions:row.presentSessions,attendanceRate},new Set(input.evidence.map((item)=>item.code)));
      if(input.outcome==="APPROVED"&&!evaluation.eligible){await transaction.commit();return "NOT_ELIGIBLE";}
      const snapshotValue={programId:row.programId,programVersionId:row.programVersionId,versionNumber:row.versionNumber,versionLabel:row.versionLabel,criteria,metrics:{recordedSessions:row.recordedSessions,presentSessions:row.presentSessions,attendanceRate},checks:evaluation.checks,eligible:evaluation.eligible}; const snapshot=JSON.stringify(snapshotValue); const evidenceJson=JSON.stringify(input.evidence); const eventEvidenceJson=JSON.stringify({promotionDecisionId:input.promotionDecisionId,snapshot:snapshotValue,evidence:input.evidence});
      const request=new sql.Request(transaction).input("decision",sql.UniqueIdentifier,input.promotionDecisionId).input("event",sql.UniqueIdentifier,input.conditionEventId).input("tenant",sql.UniqueIdentifier,row.tenantId).input("club",sql.UniqueIdentifier,row.clubId).input("enrollment",sql.UniqueIdentifier,input.enrollmentId).input("membership",sql.UniqueIdentifier,row.membershipId).input("outcome",sql.VarChar(20),input.outcome).input("snapshot",sql.NVarChar(sql.MAX),snapshot).input("evidence",sql.NVarChar(sql.MAX),evidenceJson).input("eventEvidence",sql.NVarChar(sql.MAX),eventEvidenceJson).input("reason",sql.NVarChar(1000),input.reason).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("assignment",sql.UniqueIdentifier,row.actorAssignmentId).input("now",sql.DateTime2(3),input.now);
      await request.query(`
        INSERT INTO [C_training].promotion_decision(promotion_decision_id,tenant_id,club_id,enrollment_id,membership_id,outcome,criteria_snapshot_json,evidence_json,reason,decided_by_account_id,actor_access_assignment_id,decided_at_utc) VALUES (@decision,@tenant,@club,@enrollment,@membership,@outcome,@snapshot,@evidence,@reason,@actor,@assignment,@now);
        IF @outcome='APPROVED' BEGIN
          UPDATE [C_membership].club_membership SET member_condition='COLPORTOR' WHERE tenant_id=@tenant AND club_id=@club AND membership_id=@membership AND member_condition='ASPIRANT';
          IF @@ROWCOUNT<>1 THROW 51000,'Membership transition conflict',1;
          INSERT INTO [C_membership].condition_event(condition_event_id,tenant_id,club_id,membership_id,previous_condition,new_condition,transition_method,actor_account_id,actor_access_assignment_id,reason,evidence_json,occurred_at_utc) VALUES (@event,@tenant,@club,@membership,'ASPIRANT','COLPORTOR','TRAINING_COMPLETION',@actor,@assignment,@reason,@eventEvidence,@now);
        END;
      `);
      const response:PromotionDecisionResult={promotionDecisionId:input.promotionDecisionId,enrollmentId:input.enrollmentId,membershipId:row.membershipId,outcome:input.outcome,eligible:evaluation.eligible,memberCondition:input.outcome==="APPROVED"?"COLPORTOR":"ASPIRANT",replayed:false}; await this.finish(transaction,row,input,"DECIDE_TRAINING_PROMOTION","PROMOTION_DECISION",input.promotionDecisionId,response); await transaction.commit(); return response;
    }catch(error){await transaction.rollback().catch(()=>undefined);throw error;}
  }

  public async decideExperienceRecognition(input:Parameters<MemberTransitionStore["decideExperienceRecognition"]>[0]):Promise<ExperienceRecognitionResult|TransitionStoreError>{
    const transaction=new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try{
      const row=(await new sql.Request(transaction).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("membership",sql.UniqueIdentifier,input.membershipId).query<MembershipRow>(`
        SELECT cm.tenant_id AS tenantId,cm.club_id AS clubId,cm.member_condition AS memberCondition,
          (SELECT TOP (1) aa.access_assignment_id FROM [C_authorization].access_assignment aa JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id AND p.code='membership.experience-recognition.decide' AND p.status='ACTIVE' WHERE aa.account_id=@actor AND aa.tenant_id=cm.tenant_id AND aa.status='ACTIVE' AND aa.scope_type IN ('INSTITUTION','CLUB') AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME()) AND (aa.scope_type='INSTITUTION' OR aa.club_id=cm.club_id)) AS actorAssignmentId
        FROM [C_membership].club_membership cm WITH (UPDLOCK,HOLDLOCK) WHERE cm.membership_id=@membership AND cm.membership_status IN ('PENDING','ACTIVE');
      `)).recordset[0];
      if(row===undefined){await transaction.commit();return "NOT_FOUND";} if(row.actorAssignmentId===null){await transaction.commit();return "FORBIDDEN";}
      const replay=await this.readReplay<ExperienceRecognitionResult>(transaction,row.tenantId,input,"DECIDE_EXPERIENCE_RECOGNITION"); if(replay!==null){await transaction.commit();return replay;}
      if(row.memberCondition!=="ASPIRANT"){await transaction.commit();return "CONFLICT";}
      const evidenceJson=JSON.stringify(input.evidence); const eventEvidenceJson=JSON.stringify({experienceRecognitionId:input.experienceRecognitionId,experienceSummary:input.experienceSummary,evidence:input.evidence}); const request=new sql.Request(transaction).input("recognition",sql.UniqueIdentifier,input.experienceRecognitionId).input("event",sql.UniqueIdentifier,input.conditionEventId).input("tenant",sql.UniqueIdentifier,row.tenantId).input("club",sql.UniqueIdentifier,row.clubId).input("membership",sql.UniqueIdentifier,input.membershipId).input("outcome",sql.VarChar(20),input.outcome).input("summary",sql.NVarChar(2000),input.experienceSummary).input("evidence",sql.NVarChar(sql.MAX),evidenceJson).input("eventEvidence",sql.NVarChar(sql.MAX),eventEvidenceJson).input("reason",sql.NVarChar(1000),input.reason).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("assignment",sql.UniqueIdentifier,row.actorAssignmentId).input("now",sql.DateTime2(3),input.now);
      await request.query(`
        INSERT INTO [C_membership].experience_recognition(experience_recognition_id,tenant_id,club_id,membership_id,outcome,experience_summary,evidence_json,reason,decided_by_account_id,actor_access_assignment_id,decided_at_utc) VALUES (@recognition,@tenant,@club,@membership,@outcome,@summary,@evidence,@reason,@actor,@assignment,@now);
        IF @outcome='APPROVED' BEGIN
          UPDATE [C_membership].club_membership SET member_condition='COLPORTOR' WHERE tenant_id=@tenant AND club_id=@club AND membership_id=@membership AND member_condition='ASPIRANT';
          IF @@ROWCOUNT<>1 THROW 51000,'Membership transition conflict',1;
          INSERT INTO [C_membership].condition_event(condition_event_id,tenant_id,club_id,membership_id,previous_condition,new_condition,transition_method,actor_account_id,actor_access_assignment_id,reason,evidence_json,occurred_at_utc) VALUES (@event,@tenant,@club,@membership,'ASPIRANT','COLPORTOR','PRIOR_EXPERIENCE_RECOGNITION',@actor,@assignment,@reason,@eventEvidence,@now);
        END;
      `);
      const response:ExperienceRecognitionResult={experienceRecognitionId:input.experienceRecognitionId,membershipId:input.membershipId,outcome:input.outcome,memberCondition:input.outcome==="APPROVED"?"COLPORTOR":"ASPIRANT",replayed:false}; await this.finish(transaction,row,input,"DECIDE_EXPERIENCE_RECOGNITION","EXPERIENCE_RECOGNITION",input.experienceRecognitionId,response); await transaction.commit(); return response;
    }catch(error){await transaction.rollback().catch(()=>undefined);throw error;}
  }

  public async readHistory(input:Parameters<MemberTransitionStore["readHistory"]>[0]):Promise<TransitionHistory|"FORBIDDEN"|"NOT_FOUND">{
    const membership=(await this.pool.request().input("actor",sql.UniqueIdentifier,input.actorAccountId).input("membership",sql.UniqueIdentifier,input.membershipId).query<{memberCondition:"ASPIRANT"|"COLPORTOR";authorized:boolean|number}>(`
      SELECT cm.member_condition AS memberCondition,CAST(CASE WHEN EXISTS(SELECT 1 FROM [C_authorization].access_assignment aa JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id JOIN [C_authorization].permission p ON p.permission_id=rp.permission_id AND p.code='membership.transition-history.read' AND p.status='ACTIVE' WHERE aa.account_id=@actor AND aa.tenant_id=cm.tenant_id AND aa.status='ACTIVE' AND aa.scope_type IN('INSTITUTION','CLUB') AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME()) AND (aa.scope_type='INSTITUTION' OR aa.club_id=cm.club_id)) THEN 1 ELSE 0 END AS bit) AS authorized FROM [C_membership].club_membership cm WHERE cm.membership_id=@membership;
    `)).recordset[0];
    if(membership===undefined)return "NOT_FOUND"; if(!membership.authorized)return "FORBIDDEN";
    const rows=(await this.pool.request().input("membership",sql.UniqueIdentifier,input.membershipId).query<HistoryEventRow>(`SELECT condition_event_id AS conditionEventId,previous_condition AS previousCondition,new_condition AS newCondition,transition_method AS transitionMethod,reason,evidence_json AS evidenceJson,actor_account_id AS actorAccountId,occurred_at_utc AS occurredAt FROM [C_membership].condition_event WHERE membership_id=@membership ORDER BY occurred_at_utc,condition_event_id;`)).recordset;
    return {membershipId:input.membershipId,memberCondition:membership.memberCondition,events:rows.map(({evidenceJson,...event})=>({...event,evidence:evidenceJson===null?null:JSON.parse(evidenceJson) as unknown}))};
  }

  private async readReplay<T>(transaction:sql.Transaction,tenantId:string,input:WriteContext,operation:string):Promise<T|"IDEMPOTENCY_CONFLICT"|null>{
    const row=(await new sql.Request(transaction).input("tenant",sql.UniqueIdentifier,tenantId).input("subject",sql.VarBinary(32),input.subjectHash).input("operation",sql.VarChar(100),operation).input("key",sql.VarChar(100),input.idempotencyKey).query<IdempotencyRow>(`SELECT request_hash AS requestHash,response_json AS responseJson FROM [C_audit].idempotency_record WITH (UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenant AND subject_hash=@subject AND operation=@operation AND idempotency_key=@key AND status='COMPLETED';`)).recordset[0];
    if(row===undefined)return null; return row.requestHash.equals(input.requestHash)?{...(JSON.parse(row.responseJson) as T&object),replayed:true} as T:"IDEMPOTENCY_CONFLICT";
  }

  private async finish(transaction:sql.Transaction,scope:{tenantId:string},input:WriteContext,operation:string,resourceType:string,resourceId:string,response:unknown):Promise<void>{
    const json=JSON.stringify(response); await new sql.Request(transaction).input("id",sql.UniqueIdentifier,randomUUID()).input("tenant",sql.UniqueIdentifier,scope.tenantId).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("subject",sql.VarBinary(32),input.subjectHash).input("operation",sql.VarChar(100),operation).input("key",sql.VarChar(100),input.idempotencyKey).input("requestHash",sql.VarBinary(32),input.requestHash).input("response",sql.NVarChar(sql.MAX),json).input("resourceType",sql.VarChar(100),resourceType).input("resourceId",sql.NVarChar(100),resourceId).input("correlation",sql.UniqueIdentifier,input.correlationId).input("now",sql.DateTime2(3),input.now).query(`INSERT INTO [C_audit].idempotency_record(idempotency_record_id,tenant_id,actor_account_id,subject_hash,operation,idempotency_key,request_hash,status,response_status,response_json,resource_type,resource_id,created_at_utc,completed_at_utc) VALUES(@id,@tenant,@actor,@subject,@operation,@key,@requestHash,'COMPLETED',200,@response,@resourceType,@resourceId,@now,@now); INSERT INTO [C_audit].audit_event(tenant_id,actor_account_id,action,entity_type,entity_id,correlation_id,after_json,occurred_at_utc) VALUES(@tenant,@actor,@operation,@resourceType,@resourceId,@correlation,@response,@now);`);
  }
}
