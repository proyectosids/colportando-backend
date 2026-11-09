import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/composition/create-app.js";
import { AuthService } from "../../src/modules/auth/application/auth-service.js";
import type { AuthTokenCodec, PasswordHasher } from "../../src/modules/auth/application/ports/auth-crypto.js";
import type { AuthStore } from "../../src/modules/auth/application/ports/auth-store.js";
import { TrainingService } from "../../src/modules/training/application/training-service.js";
import type { TrainingStore } from "../../src/modules/training/application/ports/training-store.js";
import {MemberTransitionService} from "../../src/modules/training/application/member-transition-service.js";
import type {MemberTransitionStore} from "../../src/modules/training/application/ports/member-transition-store.js";
import type { AppConfig } from "../../src/shared/infrastructure/config/env.js";

const accountId = "616ef081-6319-4c77-99d7-445bc64022fc";
const clubId = "1454389c-dc3c-411a-ad84-1f2e294470bc";
const versionId = "b0641547-c7f6-4ed9-b1dd-2de23c7c46c4";
const enrollmentId = "7f7bdfcb-8798-470b-9859-30840a6fb860";

function app() {
  const account = { accountId, email: "facilitator@example.com", passwordHash: "hash", status: "ACTIVE" as const };
  const authStore: AuthStore = { findAccountByEmail: vi.fn(), findActiveAccountBySession: vi.fn().mockResolvedValue(account), createSession: vi.fn(), rotateRefreshToken: vi.fn(), revokeByRefreshToken: vi.fn(), storeActionToken: vi.fn(), consumeEmailVerification: vi.fn(), consumePasswordReset: vi.fn() };
  const passwords: PasswordHasher = { hash: vi.fn(), verify: vi.fn() };
  const tokens: AuthTokenCodec = { createOpaqueToken: vi.fn(), hashOpaqueToken: vi.fn(), issueAccessToken: vi.fn(), verifyAccessToken: vi.fn().mockResolvedValue({ accountId, sessionId: "7b9d589b-a323-42ce-8704-579cb950026d" }) };
  const config: AppConfig = { nodeEnv: "test", port: 3000, logLevel: "silent", trustProxy: false, corsAllowedOrigins: ["https://app.example"], swaggerEnabled: true, auth: { jwtIssuer: "test", jwtAudience: "test", jwtAccessSecret: "test-access-secret-at-least-32-characters", accessTtlSeconds: 900, tokenPepper: "test-token-pepper-at-least-32-characters", refreshTtlSeconds: 2_592_000, sessionTtlSeconds: 7_776_000, actionTokenTtlSeconds: 3_600, invitationTtlSeconds: 604_800, passwordMinLength: 12 }, mail: { adapter: "disabled", fromName: "Colportando App", actionBaseUrl: "https://app.example/auth" } };
  const auth = new AuthService(authStore, passwords, tokens, { deliver: vi.fn() }, config.auth);
  const trainingStore: TrainingStore = {
    createProgram: vi.fn().mockResolvedValue({ programId: "8b362786-e89a-42bd-b527-ccac260fcd2f", programVersionId: versionId, clubId, code: "BASIC", name: "Formación básica", versionNumber: 1, versionLabel: "2026", replayed: false }),
    createSession: vi.fn(), changeSessionStatus: vi.fn(), enrollMembership: vi.fn(), recordAttendance: vi.fn(),
    readProgress: vi.fn().mockResolvedValue({ enrollmentId, membershipId: "2e173550-09cd-4e34-89c4-26c7f8a0ef64", programId: "8b362786-e89a-42bd-b527-ccac260fcd2f", programVersionId: versionId, programName: "Formación básica", versionNumber: 1, versionLabel: "2026", enrollmentStatus: "ENROLLED", memberCondition: "ASPIRANT", totalSessions: 2, recordedSessions: 1, presentSessions: 1, absentSessions: 0, excusedSessions: 0 })
  };
  const transitionStore:MemberTransitionStore={configureCriteria:vi.fn().mockResolvedValue({programVersionId:versionId,criteria:{minimumPresentSessions:1,requiredEvidenceCodes:["CERTIFICATE"]},replayed:false}),decidePromotion:vi.fn().mockResolvedValue({promotionDecisionId:"8b362786-e89a-42bd-b527-ccac260fcd2f",enrollmentId,membershipId:"2e173550-09cd-4e34-89c4-26c7f8a0ef64",outcome:"APPROVED",eligible:true,memberCondition:"COLPORTOR",replayed:false}),decideExperienceRecognition:vi.fn().mockResolvedValue({experienceRecognitionId:"93932f10-8732-449c-b7fb-6530fd8aa782",membershipId:"2e173550-09cd-4e34-89c4-26c7f8a0ef64",outcome:"REJECTED",memberCondition:"ASPIRANT",replayed:false}),readHistory:vi.fn().mockResolvedValue({membershipId:"2e173550-09cd-4e34-89c4-26c7f8a0ef64",memberCondition:"COLPORTOR",events:[]})};
  return createApp({ config, logger: pino({ level: "silent" }), authService: auth, trainingService: new TrainingService(trainingStore),memberTransitionService:new MemberTransitionService(transitionStore) });
}

describe("training HTTP API", () => {
  it("creates a versioned club program with an idempotency key", async () => {
    const response = await request(app()).post("/api/v1/training/programs").set("authorization", "Bearer token").set("idempotency-key", "program-http-001").send({ clubId, code: "basic", name: "Formación básica", versionLabel: "2026" }).expect(201);
    expect(response.body).toMatchObject({ code: "BASIC", versionNumber: 1, replayed: false });
  });

  it("rejects promotion fields from training writes", async () => {
    await request(app()).post("/api/v1/training/programs").set("authorization", "Bearer token").set("idempotency-key", "program-http-002").send({ clubId, code: "basic", name: "Formación", versionLabel: "2026", memberCondition: "COLPORTOR" }).expect(400);
  });

  it("returns progress explicitly without automatic promotion", async () => {
    const response = await request(app()).get(`/api/v1/training/enrollments/${enrollmentId}/progress`).set("authorization", "Bearer token").expect(200);
    expect(response.body).toMatchObject({ attendanceRate: 100, eligibility: "NOT_EVALUATED", promotedAutomatically: false, memberCondition: "ASPIRANT" });
  });
  it("requires explicit version criteria and an administrative promotion decision",async()=>{
    await request(app()).put(`/api/v1/training/program-versions/${versionId}/promotion-criteria`).set("authorization","Bearer token").set("idempotency-key","criteria-http-001").send({criteria:{}}).expect(400);
    const response=await request(app()).post(`/api/v1/training/enrollments/${enrollmentId}/promotion-decisions`).set("authorization","Bearer token").set("idempotency-key","promotion-http-001").send({outcome:"APPROVED",reason:"Cumple criterios",evidence:[{code:"CERTIFICATE",reference:"doc:1"}]}).expect(201);
    expect(response.body).toMatchObject({outcome:"APPROVED",eligible:true,memberCondition:"COLPORTOR"});
  });
  it("keeps experience recognition separate and rejects attendance payloads",async()=>{
    const membershipId="2e173550-09cd-4e34-89c4-26c7f8a0ef64";
    await request(app()).post(`/api/v1/training/memberships/${membershipId}/experience-recognitions`).set("authorization","Bearer token").set("idempotency-key","recognition-http-001").send({outcome:"APPROVED",reason:"Experiencia validada",experienceSummary:"Dos campañas",evidence:[{code:"LETTER",reference:"doc:2"}],attendanceRate:100}).expect(400);
  });
});
