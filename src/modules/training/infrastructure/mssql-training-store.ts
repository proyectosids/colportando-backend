import { randomUUID } from "node:crypto";

import sql from "mssql";

import type { AttendanceRecorded, EnrollmentCreated, ProgramCreated, SessionCreated, SessionStatusChanged, TrainingProgressRecord, TrainingStore, TrainingWriteResult } from "../application/ports/training-store.js";

type ScopeRow = Readonly<{ tenantId: string; clubId: string }>;
type IdempotencyRow = Readonly<{ requestHash: Buffer; responseJson: string }>;
type ProgressRow = TrainingProgressRecord & Readonly<{ authorized: boolean | number }>;

export class MssqlTrainingStore implements TrainingStore {
  public constructor(private readonly pool: sql.ConnectionPool) {}

  public createProgram(input: Parameters<TrainingStore["createProgram"]>[0]): Promise<TrainingWriteResult<ProgramCreated>> {
    return this.write(input, "training.program.manage", "CREATE_TRAINING_PROGRAM", "TRAINING_PROGRAM", input.programId, async (transaction, scope) => {
      const exists = await new sql.Request(transaction).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("club", sql.UniqueIdentifier, scope.clubId).input("code", sql.VarChar(60), input.code).query(`SELECT 1 AS found FROM [C_training].training_program WHERE tenant_id=@tenant AND club_id=@club AND code=@code;`);
      if (exists.recordset.length > 0) return "CONFLICT";
      await new sql.Request(transaction).input("program", sql.UniqueIdentifier, input.programId).input("version", sql.UniqueIdentifier, input.programVersionId).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("club", sql.UniqueIdentifier, scope.clubId).input("code", sql.VarChar(60), input.code).input("name", sql.NVarChar(180), input.name).input("label", sql.NVarChar(120), input.versionLabel).input("starts", sql.Date, input.startsOn ?? null).input("ends", sql.Date, input.endsOn ?? null).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("now", sql.DateTime2(3), input.now).query(`
        INSERT INTO [C_training].training_program (program_id,tenant_id,club_id,code,name,created_by_account_id,created_at_utc) VALUES (@program,@tenant,@club,@code,@name,@actor,@now);
        INSERT INTO [C_training].program_version (program_version_id,tenant_id,club_id,program_id,version_number,label,status,starts_on,ends_on,created_by_account_id,created_at_utc) VALUES (@version,@tenant,@club,@program,1,@label,'ACTIVE',@starts,@ends,@actor,@now);
      `);
      return { programId: input.programId, programVersionId: input.programVersionId, clubId: scope.clubId, code: input.code, name: input.name, versionNumber: 1, versionLabel: input.versionLabel, replayed: false };
    });
  }

  public async createSession(input: Parameters<TrainingStore["createSession"]>[0]): Promise<TrainingWriteResult<SessionCreated>> {
    const result = await this.writeForVersion<SessionCreated>(input, "training.session.manage", "CREATE_TRAINING_SESSION", "TRAINING_SESSION", input.sessionId, async (transaction, scope) => {
      await new sql.Request(transaction).input("session", sql.UniqueIdentifier, input.sessionId).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("club", sql.UniqueIdentifier, scope.clubId).input("version", sql.UniqueIdentifier, input.programVersionId).input("title", sql.NVarChar(180), input.title).input("starts", sql.DateTime2(3), input.startsAt).input("ends", sql.DateTime2(3), input.endsAt).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("now", sql.DateTime2(3), input.now).query(`INSERT INTO [C_training].training_session (session_id,tenant_id,club_id,program_version_id,title,starts_at_utc,ends_at_utc,status,created_by_account_id,created_at_utc) VALUES (@session,@tenant,@club,@version,@title,@starts,@ends,'OPEN',@actor,@now);`);
      return { sessionId: input.sessionId, programVersionId: input.programVersionId, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt, status: "OPEN", replayed: false };
    });
    if (typeof result === "string") return result;
    return { ...result, startsAt: new Date(result.startsAt), endsAt: new Date(result.endsAt) };
  }

  public enrollMembership(input: Parameters<TrainingStore["enrollMembership"]>[0]): Promise<TrainingWriteResult<EnrollmentCreated>> {
    return this.writeForVersion(input, "training.enrollment.manage", "CREATE_TRAINING_ENROLLMENT", "TRAINING_ENROLLMENT", input.enrollmentId, async (transaction, scope) => {
      const member = await new sql.Request(transaction).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("club", sql.UniqueIdentifier, scope.clubId).input("membership", sql.UniqueIdentifier, input.membershipId).input("version", sql.UniqueIdentifier, input.programVersionId).query(`
        SELECT TOP (1) 1 AS found FROM [C_membership].club_membership cm
        JOIN [C_training].program_version pv ON pv.tenant_id=cm.tenant_id AND pv.club_id=cm.club_id AND pv.program_version_id=@version AND pv.status='ACTIVE'
        WHERE cm.tenant_id=@tenant AND cm.club_id=@club AND cm.membership_id=@membership AND cm.member_condition='ASPIRANT' AND cm.membership_status IN ('PENDING','ACTIVE')
          AND NOT EXISTS (SELECT 1 FROM [C_training].enrollment e WHERE e.tenant_id=@tenant AND e.program_version_id=@version AND e.membership_id=@membership);
      `);
      if (member.recordset.length === 0) return "CONFLICT";
      await new sql.Request(transaction).input("enrollment", sql.UniqueIdentifier, input.enrollmentId).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("club", sql.UniqueIdentifier, scope.clubId).input("version", sql.UniqueIdentifier, input.programVersionId).input("membership", sql.UniqueIdentifier, input.membershipId).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("now", sql.DateTime2(3), input.now).query(`INSERT INTO [C_training].enrollment (enrollment_id,tenant_id,club_id,program_version_id,membership_id,status,enrolled_by_account_id,enrolled_at_utc) VALUES (@enrollment,@tenant,@club,@version,@membership,'ENROLLED',@actor,@now);`);
      return { enrollmentId: input.enrollmentId, programVersionId: input.programVersionId, membershipId: input.membershipId, status: "ENROLLED", replayed: false };
    });
  }

  public async changeSessionStatus(input: Parameters<TrainingStore["changeSessionStatus"]>[0]): Promise<TrainingWriteResult<SessionStatusChanged>> {
    const transaction = new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("session",sql.UniqueIdentifier,input.sessionId).query<ScopeRow>(`SELECT TOP (1) s.tenant_id AS tenantId,s.club_id AS clubId FROM [C_training].training_session s JOIN [C_training].program_version pv ON pv.tenant_id=s.tenant_id AND pv.club_id=s.club_id AND pv.program_version_id=s.program_version_id JOIN [C_platform].tenant t ON t.tenant_id=s.tenant_id WHERE s.session_id=@session AND t.service_status='ACTIVE' AND EXISTS (${this.permissionExistsSql("training.session.manage", "s.tenant_id", "s.club_id")});`);
      const scope=result.recordset[0]; if(scope===undefined){await transaction.commit();return "FORBIDDEN";}
      const replay=await this.readIdempotency(transaction,scope.tenantId,input.subjectHash,"CHANGE_TRAINING_SESSION_STATUS",input.idempotencyKey);
      if(replay!==null){await transaction.commit();return replay.requestHash.equals(input.requestHash)?{ ...(JSON.parse(replay.responseJson) as SessionStatusChanged), replayed:true }:"IDEMPOTENCY_CONFLICT";}
      const update=await new sql.Request(transaction).input("session",sql.UniqueIdentifier,input.sessionId).input("status",sql.VarChar(20),input.status).query<{ changed: number }>(`UPDATE [C_training].training_session SET status=@status WHERE session_id=@session AND status='OPEN'; SELECT @@ROWCOUNT AS changed;`);
      if(update.recordset[0]?.changed!==1){await transaction.commit();return "CONFLICT";}
      const response: SessionStatusChanged={sessionId:input.sessionId,status:input.status,replayed:false};
      await this.finishWrite(transaction,scope,input,"CHANGE_TRAINING_SESSION_STATUS","TRAINING_SESSION",input.sessionId,response); await transaction.commit(); return response;
    } catch(error){await transaction.rollback().catch(()=>undefined);throw error;}
  }

  public async recordAttendance(input: Parameters<TrainingStore["recordAttendance"]>[0]): Promise<TrainingWriteResult<AttendanceRecorded> | "SESSION_CLOSED"> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const scopeResult = await new sql.Request(transaction).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("session", sql.UniqueIdentifier, input.sessionId).input("enrollment", sql.UniqueIdentifier, input.enrollmentId).query<ScopeRow & { sessionStatus: string }>(`
        SELECT TOP (1) s.tenant_id AS tenantId,s.club_id AS clubId,s.status AS sessionStatus
        FROM [C_training].training_session s
        JOIN [C_training].enrollment e ON e.tenant_id=s.tenant_id AND e.club_id=s.club_id AND e.program_version_id=s.program_version_id AND e.enrollment_id=@enrollment AND e.status='ENROLLED'
        WHERE s.session_id=@session AND EXISTS (${this.permissionExistsSql("training.attendance.record", "s.tenant_id", "s.club_id")});
      `);
      const scope = scopeResult.recordset[0];
      if (scope === undefined) { await transaction.commit(); return "FORBIDDEN"; }
      const replay = await this.readIdempotency(transaction, scope.tenantId, input.subjectHash, "RECORD_TRAINING_ATTENDANCE", input.idempotencyKey);
      if (replay !== null) { await transaction.commit(); return replay.requestHash.equals(input.requestHash) ? { ...(JSON.parse(replay.responseJson) as AttendanceRecorded), replayed: true } : "IDEMPOTENCY_CONFLICT"; }
      if (scope.sessionStatus !== "OPEN") { await transaction.commit(); return "SESSION_CLOSED"; }
      const existing = await new sql.Request(transaction).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("session", sql.UniqueIdentifier, input.sessionId).input("enrollment", sql.UniqueIdentifier, input.enrollmentId).query<{ attendanceId: string }>(`SELECT attendance_id AS attendanceId FROM [C_training].session_attendance WITH (UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenant AND session_id=@session AND enrollment_id=@enrollment;`);
      const attendanceId = existing.recordset[0]?.attendanceId ?? input.attendanceId;
      await new sql.Request(transaction).input("attendance", sql.UniqueIdentifier, attendanceId).input("tenant", sql.UniqueIdentifier, scope.tenantId).input("club", sql.UniqueIdentifier, scope.clubId).input("session", sql.UniqueIdentifier, input.sessionId).input("enrollment", sql.UniqueIdentifier, input.enrollmentId).input("status", sql.VarChar(20), input.attendanceStatus).input("notes", sql.NVarChar(500), input.notes ?? null).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("now", sql.DateTime2(3), input.now).query(`
        IF EXISTS (SELECT 1 FROM [C_training].session_attendance WHERE tenant_id=@tenant AND session_id=@session AND enrollment_id=@enrollment)
          UPDATE [C_training].session_attendance SET attendance_status=@status,notes=@notes,recorded_by_account_id=@actor,updated_at_utc=@now WHERE tenant_id=@tenant AND session_id=@session AND enrollment_id=@enrollment;
        ELSE
          INSERT INTO [C_training].session_attendance (attendance_id,tenant_id,club_id,session_id,enrollment_id,attendance_status,notes,recorded_by_account_id,recorded_at_utc,updated_at_utc) VALUES (@attendance,@tenant,@club,@session,@enrollment,@status,@notes,@actor,@now,@now);
      `);
      const response: AttendanceRecorded = { attendanceId, sessionId: input.sessionId, enrollmentId: input.enrollmentId, attendanceStatus: input.attendanceStatus, replayed: false };
      await this.finishWrite(transaction, scope, input, "RECORD_TRAINING_ATTENDANCE", "TRAINING_ATTENDANCE", attendanceId, response);
      await transaction.commit(); return response;
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }

  public async readProgress(input: Parameters<TrainingStore["readProgress"]>[0]): Promise<TrainingProgressRecord | "FORBIDDEN" | null> {
    const result = await this.pool.request().input("actor", sql.UniqueIdentifier, input.actorAccountId).input("enrollment", sql.UniqueIdentifier, input.enrollmentId).query<ProgressRow>(`
      SELECT e.enrollment_id AS enrollmentId,e.membership_id AS membershipId,p.program_id AS programId,pv.program_version_id AS programVersionId,p.name AS programName,pv.version_number AS versionNumber,pv.label AS versionLabel,e.status AS enrollmentStatus,cm.member_condition AS memberCondition,
        COUNT(DISTINCT CASE WHEN s.status<>'CANCELLED' THEN s.session_id END) AS totalSessions,
        COUNT(DISTINCT a.session_id) AS recordedSessions,
        COUNT(DISTINCT CASE WHEN a.attendance_status='PRESENT' THEN a.session_id END) AS presentSessions,
        COUNT(DISTINCT CASE WHEN a.attendance_status='ABSENT' THEN a.session_id END) AS absentSessions,
        COUNT(DISTINCT CASE WHEN a.attendance_status='EXCUSED' THEN a.session_id END) AS excusedSessions,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM [C_identity].account_person_link apl WHERE apl.account_id=@actor AND apl.tenant_id=e.tenant_id AND apl.person_id=cm.person_id AND apl.status='ACTIVE')
          OR EXISTS (${this.permissionExistsSql("training.progress.read", "e.tenant_id", "e.club_id")}) THEN 1 ELSE 0 END AS bit) AS authorized
      FROM [C_training].enrollment e
      JOIN [C_training].program_version pv ON pv.tenant_id=e.tenant_id AND pv.club_id=e.club_id AND pv.program_version_id=e.program_version_id
      JOIN [C_training].training_program p ON p.tenant_id=pv.tenant_id AND p.club_id=pv.club_id AND p.program_id=pv.program_id
      JOIN [C_membership].club_membership cm ON cm.tenant_id=e.tenant_id AND cm.club_id=e.club_id AND cm.membership_id=e.membership_id
      LEFT JOIN [C_training].training_session s ON s.tenant_id=e.tenant_id AND s.club_id=e.club_id AND s.program_version_id=e.program_version_id
      LEFT JOIN [C_training].session_attendance a ON a.tenant_id=e.tenant_id AND a.session_id=s.session_id AND a.enrollment_id=e.enrollment_id
      WHERE e.enrollment_id=@enrollment
      GROUP BY e.enrollment_id,e.membership_id,p.program_id,pv.program_version_id,p.name,pv.version_number,pv.label,e.status,cm.member_condition,e.tenant_id,e.club_id,cm.person_id;
    `);
    const row = result.recordset[0];
    if (row === undefined) return null;
    if (!row.authorized) return "FORBIDDEN";
    const { authorized: _authorized, ...progress } = row;
    void _authorized;
    return progress;
  }

  private async write<T>(input: Parameters<TrainingStore["createProgram"]>[0], permission: string, operation: string, resourceType: string, resourceId: string, action: (transaction: sql.Transaction, scope: ScopeRow) => Promise<T | "CONFLICT">): Promise<TrainingWriteResult<T>> {
    const transaction = new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction).input("actor", sql.UniqueIdentifier, input.actorAccountId).input("club", sql.UniqueIdentifier, input.clubId).query<ScopeRow>(`SELECT TOP (1) c.tenant_id AS tenantId,c.club_id AS clubId FROM [C_organization].club c JOIN [C_organization].institution i ON i.tenant_id=c.tenant_id AND i.institution_id=c.institution_id JOIN [C_platform].tenant t ON t.tenant_id=c.tenant_id WHERE c.club_id=@club AND c.status='ACTIVE' AND i.status='ACTIVE' AND t.service_status='ACTIVE' AND EXISTS (${this.permissionExistsSql(permission, "c.tenant_id", "c.club_id")});`);
      const scope=result.recordset[0]; if(scope===undefined){await transaction.commit();return "FORBIDDEN";}
      return await this.executeWrite(transaction, scope, input, operation, resourceType, resourceId, action);
    } catch(error){await transaction.rollback().catch(()=>undefined);throw error;}
  }

  private async writeForVersion<T>(input: Parameters<TrainingStore["createSession"]>[0] | Parameters<TrainingStore["enrollMembership"]>[0], permission: string, operation: string, resourceType: string, resourceId: string, action: (transaction: sql.Transaction, scope: ScopeRow) => Promise<T | "CONFLICT">): Promise<TrainingWriteResult<T>> {
    const transaction=new sql.Transaction(this.pool); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result=await new sql.Request(transaction).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("version",sql.UniqueIdentifier,input.programVersionId).query<ScopeRow>(`SELECT TOP (1) pv.tenant_id AS tenantId,pv.club_id AS clubId FROM [C_training].program_version pv JOIN [C_training].training_program p ON p.tenant_id=pv.tenant_id AND p.club_id=pv.club_id AND p.program_id=pv.program_id JOIN [C_organization].club c ON c.tenant_id=pv.tenant_id AND c.club_id=pv.club_id JOIN [C_platform].tenant t ON t.tenant_id=pv.tenant_id WHERE pv.program_version_id=@version AND pv.status='ACTIVE' AND p.status='ACTIVE' AND c.status='ACTIVE' AND t.service_status='ACTIVE' AND EXISTS (${this.permissionExistsSql(permission, "pv.tenant_id", "pv.club_id")});`);
      const scope=result.recordset[0]; if(scope===undefined){await transaction.commit();return "FORBIDDEN";}
      return await this.executeWrite(transaction,scope,input,operation,resourceType,resourceId,action);
    } catch(error){await transaction.rollback().catch(()=>undefined);throw error;}
  }

  private async executeWrite<T>(transaction: sql.Transaction, scope: ScopeRow, input: { actorAccountId: string; idempotencyKey: string; requestHash: Buffer; subjectHash: Buffer; correlationId: string; now: Date }, operation: string, resourceType: string, resourceId: string, action: (transaction: sql.Transaction, scope: ScopeRow) => Promise<T | "CONFLICT">): Promise<TrainingWriteResult<T>> {
    const replay=await this.readIdempotency(transaction,scope.tenantId,input.subjectHash,operation,input.idempotencyKey);
    if(replay!==null){await transaction.commit();return replay.requestHash.equals(input.requestHash)?{ ...(JSON.parse(replay.responseJson) as T & object), replayed: true } as T:"IDEMPOTENCY_CONFLICT";}
    const response=await action(transaction,scope); if(response==="CONFLICT"){await transaction.commit();return response;}
    await this.finishWrite(transaction,scope,input,operation,resourceType,resourceId,response); await transaction.commit(); return response;
  }

  private permissionExistsSql(permission: string, tenantExpression: string, clubExpression: string): string {
    return `SELECT 1 FROM [C_authorization].access_assignment aa JOIN [C_authorization].role_permission rp ON rp.role_id=aa.role_id JOIN [C_authorization].permission pe ON pe.permission_id=rp.permission_id WHERE aa.account_id=@actor AND aa.status='ACTIVE' AND (aa.expires_at_utc IS NULL OR aa.expires_at_utc>SYSUTCDATETIME()) AND pe.code='${permission}' AND pe.status='ACTIVE' AND (aa.scope_type='PLATFORM' OR (aa.scope_type='INSTITUTION' AND aa.tenant_id=${tenantExpression}) OR (aa.scope_type='CLUB' AND aa.tenant_id=${tenantExpression} AND aa.club_id=${clubExpression}))`;
  }

  private async readIdempotency(transaction: sql.Transaction, tenantId: string, subjectHash: Buffer, operation: string, key: string): Promise<IdempotencyRow | null> {
    const result=await new sql.Request(transaction).input("tenant",sql.UniqueIdentifier,tenantId).input("subjectHash",sql.VarBinary(32),subjectHash).input("operation",sql.VarChar(100),operation).input("key",sql.VarChar(100),key).query<IdempotencyRow>(`SELECT request_hash AS requestHash,response_json AS responseJson FROM [C_audit].idempotency_record WITH (UPDLOCK,HOLDLOCK) WHERE tenant_id=@tenant AND subject_hash=@subjectHash AND operation=@operation AND idempotency_key=@key AND status='COMPLETED';`);
    return result.recordset[0]??null;
  }

  private async finishWrite(transaction: sql.Transaction, scope: ScopeRow, input: { actorAccountId: string; idempotencyKey: string; requestHash: Buffer; subjectHash: Buffer; correlationId: string; now: Date }, operation: string, resourceType: string, resourceId: string, response: unknown): Promise<void> {
    const responseJson=JSON.stringify(response);
    await new sql.Request(transaction).input("id",sql.UniqueIdentifier,randomUUID()).input("tenant",sql.UniqueIdentifier,scope.tenantId).input("actor",sql.UniqueIdentifier,input.actorAccountId).input("subjectHash",sql.VarBinary(32),input.subjectHash).input("operation",sql.VarChar(100),operation).input("key",sql.VarChar(100),input.idempotencyKey).input("requestHash",sql.VarBinary(32),input.requestHash).input("response",sql.NVarChar(sql.MAX),responseJson).input("resourceType",sql.VarChar(100),resourceType).input("resourceId",sql.NVarChar(100),resourceId).input("now",sql.DateTime2(3),input.now).input("correlation",sql.UniqueIdentifier,input.correlationId).query(`
      INSERT INTO [C_audit].idempotency_record (idempotency_record_id,tenant_id,actor_account_id,subject_hash,operation,idempotency_key,request_hash,status,response_status,response_json,resource_type,resource_id,created_at_utc,completed_at_utc) VALUES (@id,@tenant,@actor,@subjectHash,@operation,@key,@requestHash,'COMPLETED',201,@response,@resourceType,@resourceId,@now,@now);
      INSERT INTO [C_audit].audit_event (tenant_id,actor_account_id,action,entity_type,entity_id,correlation_id,after_json,occurred_at_utc) VALUES (@tenant,@actor,@operation,@resourceType,@resourceId,@correlation,@response,@now);
    `);
  }
}
