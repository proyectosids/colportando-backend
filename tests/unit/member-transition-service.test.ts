import {describe,expect,it,vi} from "vitest";

import {MemberTransitionService} from "../../src/modules/training/application/member-transition-service.js";
import type {MemberTransitionStore} from "../../src/modules/training/application/ports/member-transition-store.js";
import {evaluatePromotionCriteria} from "../../src/modules/training/domain/promotion-criteria.js";

const actor="616ef081-6319-4c77-99d7-445bc64022fc",enrollment="7f7bdfcb-8798-470b-9859-30840a6fb860",membership="2e173550-09cd-4e34-89c4-26c7f8a0ef64";
function fixtures(overrides:Partial<MemberTransitionStore>={}){
  const store:MemberTransitionStore={configureCriteria:vi.fn().mockResolvedValue({programVersionId:"b0641547-c7f6-4ed9-b1dd-2de23c7c46c4",criteria:{minimumPresentSessions:2,requiredEvidenceCodes:["CERTIFICATE"]},replayed:false}),decidePromotion:vi.fn().mockResolvedValue({promotionDecisionId:"8b362786-e89a-42bd-b527-ccac260fcd2f",enrollmentId:enrollment,membershipId:membership,outcome:"APPROVED",eligible:true,memberCondition:"COLPORTOR",replayed:false}),decideExperienceRecognition:vi.fn().mockResolvedValue({experienceRecognitionId:"93932f10-8732-449c-b7fb-6530fd8aa782",membershipId:membership,outcome:"REJECTED",memberCondition:"ASPIRANT",replayed:false}),readHistory:vi.fn().mockResolvedValue({membershipId:membership,memberCondition:"ASPIRANT",events:[]}),...overrides};
  return {store,service:new MemberTransitionService(store,()=>new Date("2026-11-09T12:00:00Z"))};
}
describe("member transitions",()=>{
  it("evaluates only explicitly configured version criteria",()=>{
    expect(evaluatePromotionCriteria({minimumPresentSessions:2,minimumAttendanceRate:75,requiredEvidenceCodes:["CERTIFICATE"]},{presentSessions:2,recordedSessions:2,attendanceRate:100},new Set(["CERTIFICATE"]))).toMatchObject({eligible:true});
    expect(evaluatePromotionCriteria({minimumAttendanceRate:90,requiredEvidenceCodes:[]},{presentSessions:1,recordedSessions:2,attendanceRate:50},new Set())).toMatchObject({eligible:false});
  });
  it("keeps promotion and recognition as distinct store operations",async()=>{
    const {service,store}=fixtures();
    await service.decidePromotion({actorAccountId:actor,enrollmentId:enrollment,outcome:"APPROVED",reason:"Cumple criterios",evidence:[{code:"CERTIFICATE",reference:"doc:1"}],idempotencyKey:"promotion-001",correlationId:"6f8ee7e2-78a8-4cf5-943e-a67b970b0a14"});
    await service.decideExperienceRecognition({actorAccountId:actor,membershipId:membership,outcome:"REJECTED",reason:"Evidencia insuficiente",experienceSummary:"Experiencia declarada",evidence:[{code:"LETTER",reference:"doc:2"}],idempotencyKey:"recognition-001",correlationId:"6f8ee7e2-78a8-4cf5-943e-a67b970b0a14"});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.decidePromotion)).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(store.decideExperienceRecognition)).toHaveBeenCalledOnce();
  });
  it("does not turn missing criteria into a default threshold",async()=>{
    const {service}=fixtures({decidePromotion:vi.fn().mockResolvedValue("CRITERIA_NOT_CONFIGURED")});
    await expect(service.decidePromotion({actorAccountId:actor,enrollmentId:enrollment,outcome:"APPROVED",reason:"Intento",evidence:[{code:"CERTIFICATE",reference:"doc:1"}],idempotencyKey:"promotion-002",correlationId:"6f8ee7e2-78a8-4cf5-943e-a67b970b0a14"})).rejects.toMatchObject({code:"PROMOTION_CRITERIA_NOT_CONFIGURED",statusCode:409});
  });
});
