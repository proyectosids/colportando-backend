import { describe, expect, it, vi } from "vitest";

import { TrainingService } from "../../src/modules/training/application/training-service.js";
import type { TrainingStore } from "../../src/modules/training/application/ports/training-store.js";

const actorAccountId = "616ef081-6319-4c77-99d7-445bc64022fc";
const clubId = "1454389c-dc3c-411a-ad84-1f2e294470bc";
const versionId = "b0641547-c7f6-4ed9-b1dd-2de23c7c46c4";
const enrollmentId = "7f7bdfcb-8798-470b-9859-30840a6fb860";

function fixtures(overrides: Partial<TrainingStore> = {}) {
  const store: TrainingStore = {
    createProgram: vi.fn().mockResolvedValue({ programId: "8b362786-e89a-42bd-b527-ccac260fcd2f", programVersionId: versionId, clubId, code: "BASIC", name: "Formación básica", versionNumber: 1, versionLabel: "2026", replayed: false }),
    createSession: vi.fn().mockResolvedValue({ sessionId: "93932f10-8732-449c-b7fb-6530fd8aa782", programVersionId: versionId, title: "Sesión 1", startsAt: new Date("2026-11-10T14:00:00Z"), endsAt: new Date("2026-11-10T16:00:00Z"), status: "OPEN", replayed: false }),
    changeSessionStatus: vi.fn().mockResolvedValue({ sessionId: "93932f10-8732-449c-b7fb-6530fd8aa782", status: "CLOSED", replayed: false }),
    enrollMembership: vi.fn().mockResolvedValue({ enrollmentId, programVersionId: versionId, membershipId: "2e173550-09cd-4e34-89c4-26c7f8a0ef64", status: "ENROLLED", replayed: false }),
    recordAttendance: vi.fn().mockResolvedValue({ attendanceId: "47a4c5f1-1d38-4ea5-a031-54bfcbade1a1", sessionId: "93932f10-8732-449c-b7fb-6530fd8aa782", enrollmentId, attendanceStatus: "PRESENT", replayed: false }),
    readProgress: vi.fn().mockResolvedValue({ enrollmentId, membershipId: "2e173550-09cd-4e34-89c4-26c7f8a0ef64", programId: "8b362786-e89a-42bd-b527-ccac260fcd2f", programVersionId: versionId, programName: "Formación básica", versionNumber: 1, versionLabel: "2026", enrollmentStatus: "ENROLLED", memberCondition: "ASPIRANT", totalSessions: 4, recordedSessions: 3, presentSessions: 2, absentSessions: 1, excusedSessions: 0 }),
    ...overrides
  };
  return { store, service: new TrainingService(store, () => new Date("2026-11-09T12:00:00Z")) };
}

describe("TrainingService", () => {
  it("normalizes a program but never defines promotion criteria", async () => {
    const { service, store } = fixtures();
    await service.createProgram({ actorAccountId, clubId, code: " basic ", name: " Formación   básica ", versionLabel: " 2026 ", idempotencyKey: "training-program-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.createProgram)).toHaveBeenCalledWith(expect.objectContaining({ code: "BASIC", name: "Formación básica", versionLabel: "2026" }));
  });

  it("returns factual progress without automatic eligibility or promotion", async () => {
    const { service } = fixtures();
    const progress = await service.getProgress(actorAccountId, enrollmentId);
    expect(progress).toMatchObject({ attendanceRate: 66.67, eligibility: "NOT_EVALUATED", promotedAutomatically: false, memberCondition: "ASPIRANT" });
  });

  it("rejects attendance changes when the session is closed", async () => {
    const { service } = fixtures({ recordAttendance: vi.fn().mockResolvedValue("SESSION_CLOSED") });
    await expect(service.recordAttendance({ actorAccountId, sessionId: "93932f10-8732-449c-b7fb-6530fd8aa782", enrollmentId, attendanceStatus: "PRESENT", idempotencyKey: "attendance-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" })).rejects.toMatchObject({ statusCode: 409, code: "TRAINING_SESSION_CLOSED" });
  });

  it("rejects reuse of an idempotency key for a different enrollment request", async () => {
    const { service } = fixtures({ enrollMembership: vi.fn().mockResolvedValue("IDEMPOTENCY_CONFLICT") });
    await expect(service.enroll({ actorAccountId, programVersionId: versionId, membershipId: "2e173550-09cd-4e34-89c4-26c7f8a0ef64", idempotencyKey: "enrollment-001", correlationId: "6f8ee7e2-78a8-4cf5-943e-a67b970b0a14" })).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
  });
});
