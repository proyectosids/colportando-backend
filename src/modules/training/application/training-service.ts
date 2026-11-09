import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../shared/presentation/http/errors/app-error.js";
import { calculateAttendanceRate, type AttendanceStatus } from "../domain/training-progress.js";
import type { TrainingStore, TrainingWriteResult } from "./ports/training-store.js";

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ");
const digest = (value: unknown): Buffer => createHash("sha256").update(JSON.stringify(value)).digest();
const subjectHash = (actorAccountId: string): Buffer => digest({ actorAccountId: actorAccountId.toLowerCase() });

export class TrainingService {
  public constructor(private readonly store: TrainingStore, private readonly now: () => Date = () => new Date()) {}

  public async createProgram(input: Readonly<{ actorAccountId: string; clubId: string; code: string; name: string; versionLabel: string; startsOn?: string; endsOn?: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { clubId: input.clubId.toLowerCase(), code: input.code.trim().toUpperCase(), name: normalizeText(input.name), versionLabel: normalizeText(input.versionLabel), startsOn: input.startsOn ?? null, endsOn: input.endsOn ?? null };
    return this.unwrap(await this.store.createProgram({ clubId: input.clubId, code: canonical.code, name: canonical.name, versionLabel: canonical.versionLabel, ...(input.startsOn === undefined ? {} : { startsOn: input.startsOn }), ...(input.endsOn === undefined ? {} : { endsOn: input.endsOn }), actorAccountId: input.actorAccountId, programId: randomUUID(), programVersionId: randomUUID(), idempotencyKey: input.idempotencyKey, requestHash: digest(canonical), subjectHash: subjectHash(input.actorAccountId), correlationId: input.correlationId, now: this.now() }), "PROGRAM");
  }

  public async createSession(input: Readonly<{ actorAccountId: string; programVersionId: string; title: string; startsAt: Date; endsAt: Date; idempotencyKey: string; correlationId: string }>) {
    if (input.endsAt <= input.startsAt) throw new AppError(400, "INVALID_SESSION_DATES", "Session end must be after its start");
    const canonical = { programVersionId: input.programVersionId.toLowerCase(), title: normalizeText(input.title), startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() };
    return this.unwrap(await this.store.createSession({ actorAccountId: input.actorAccountId, sessionId: randomUUID(), programVersionId: input.programVersionId, title: canonical.title, startsAt: input.startsAt, endsAt: input.endsAt, idempotencyKey: input.idempotencyKey, requestHash: digest(canonical), subjectHash: subjectHash(input.actorAccountId), correlationId: input.correlationId, now: this.now() }), "SESSION");
  }

  public async enroll(input: Readonly<{ actorAccountId: string; programVersionId: string; membershipId: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { programVersionId: input.programVersionId.toLowerCase(), membershipId: input.membershipId.toLowerCase() };
    return this.unwrap(await this.store.enrollMembership({ actorAccountId: input.actorAccountId, enrollmentId: randomUUID(), programVersionId: input.programVersionId, membershipId: input.membershipId, idempotencyKey: input.idempotencyKey, requestHash: digest(canonical), subjectHash: subjectHash(input.actorAccountId), correlationId: input.correlationId, now: this.now() }), "ENROLLMENT");
  }

  public async changeSessionStatus(input: Readonly<{ actorAccountId: string; sessionId: string; status: "CLOSED" | "CANCELLED"; idempotencyKey: string; correlationId: string }>) {
    const canonical = { sessionId: input.sessionId.toLowerCase(), status: input.status };
    return this.unwrap(await this.store.changeSessionStatus({ ...input, requestHash: digest(canonical), subjectHash: subjectHash(input.actorAccountId), now: this.now() }), "SESSION");
  }

  public async recordAttendance(input: Readonly<{ actorAccountId: string; sessionId: string; enrollmentId: string; attendanceStatus: AttendanceStatus; notes?: string; idempotencyKey: string; correlationId: string }>) {
    const notes = input.notes === undefined ? undefined : normalizeText(input.notes);
    const canonical = { sessionId: input.sessionId.toLowerCase(), enrollmentId: input.enrollmentId.toLowerCase(), attendanceStatus: input.attendanceStatus, notes: notes ?? null };
    const result = await this.store.recordAttendance({ actorAccountId: input.actorAccountId, attendanceId: randomUUID(), sessionId: input.sessionId, enrollmentId: input.enrollmentId, attendanceStatus: input.attendanceStatus, ...(notes === undefined ? {} : { notes }), idempotencyKey: input.idempotencyKey, requestHash: digest(canonical), subjectHash: subjectHash(input.actorAccountId), correlationId: input.correlationId, now: this.now() });
    if (result === "SESSION_CLOSED") throw new AppError(409, "TRAINING_SESSION_CLOSED", "Attendance cannot be changed for a closed or cancelled session");
    return this.unwrap(result, "ATTENDANCE");
  }

  public async getProgress(actorAccountId: string, enrollmentId: string) {
    const result = await this.store.readProgress({ actorAccountId, enrollmentId });
    if (result === "FORBIDDEN") throw new AppError(403, "TRAINING_PROGRESS_FORBIDDEN", "Account cannot read this training progress");
    if (result === null) throw new AppError(404, "TRAINING_ENROLLMENT_NOT_FOUND", "Training enrollment was not found");
    return { ...result, attendanceRate: calculateAttendanceRate(result.presentSessions, result.recordedSessions), eligibility: "NOT_EVALUATED" as const, promotedAutomatically: false as const };
  }

  private unwrap<T>(result: TrainingWriteResult<T>, entity: string): T {
    if (result === "FORBIDDEN") throw new AppError(403, `TRAINING_${entity}_FORBIDDEN`, "Account lacks the required permission or club scope");
    if (result === "CONFLICT") throw new AppError(409, `TRAINING_${entity}_CONFLICT`, "Training resource conflicts with its current state or scope");
    if (result === "IDEMPOTENCY_CONFLICT") throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request");
    return result;
  }
}
