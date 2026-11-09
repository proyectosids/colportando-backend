import type { AttendanceStatus } from "../../domain/training-progress.js";

export type TrainingWriteResult<T> = T | "FORBIDDEN" | "CONFLICT" | "IDEMPOTENCY_CONFLICT";

export type ProgramCreated = Readonly<{
  programId: string;
  programVersionId: string;
  clubId: string;
  code: string;
  name: string;
  versionNumber: 1;
  versionLabel: string;
  replayed: boolean;
}>;

export type SessionCreated = Readonly<{
  sessionId: string;
  programVersionId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: "OPEN";
  replayed: boolean;
}>;

export type EnrollmentCreated = Readonly<{
  enrollmentId: string;
  programVersionId: string;
  membershipId: string;
  status: "ENROLLED";
  replayed: boolean;
}>;

export type SessionStatusChanged = Readonly<{
  sessionId: string;
  status: "CLOSED" | "CANCELLED";
  replayed: boolean;
}>;

export type AttendanceRecorded = Readonly<{
  attendanceId: string;
  sessionId: string;
  enrollmentId: string;
  attendanceStatus: AttendanceStatus;
  replayed: boolean;
}>;

export type TrainingProgressRecord = Readonly<{
  enrollmentId: string;
  membershipId: string;
  programId: string;
  programVersionId: string;
  programName: string;
  versionNumber: number;
  versionLabel: string;
  enrollmentStatus: "ENROLLED" | "WITHDRAWN";
  memberCondition: "ASPIRANT" | "COLPORTOR";
  totalSessions: number;
  recordedSessions: number;
  presentSessions: number;
  absentSessions: number;
  excusedSessions: number;
}>;

type IdempotentInput = Readonly<{
  actorAccountId: string;
  idempotencyKey: string;
  requestHash: Buffer;
  subjectHash: Buffer;
  correlationId: string;
  now: Date;
}>;

export interface TrainingStore {
  createProgram(input: IdempotentInput & Readonly<{ programId: string; programVersionId: string; clubId: string; code: string; name: string; versionLabel: string; startsOn?: string; endsOn?: string }>): Promise<TrainingWriteResult<ProgramCreated>>;
  createSession(input: IdempotentInput & Readonly<{ sessionId: string; programVersionId: string; title: string; startsAt: Date; endsAt: Date }>): Promise<TrainingWriteResult<SessionCreated>>;
  changeSessionStatus(input: IdempotentInput & Readonly<{ sessionId: string; status: "CLOSED" | "CANCELLED" }>): Promise<TrainingWriteResult<SessionStatusChanged>>;
  enrollMembership(input: IdempotentInput & Readonly<{ enrollmentId: string; programVersionId: string; membershipId: string }>): Promise<TrainingWriteResult<EnrollmentCreated>>;
  recordAttendance(input: IdempotentInput & Readonly<{ attendanceId: string; sessionId: string; enrollmentId: string; attendanceStatus: AttendanceStatus; notes?: string }>): Promise<TrainingWriteResult<AttendanceRecorded> | "SESSION_CLOSED">;
  readProgress(input: Readonly<{ actorAccountId: string; enrollmentId: string }>): Promise<TrainingProgressRecord | "FORBIDDEN" | null>;
}
