import type { PromotionCriteria } from "../../domain/promotion-criteria.js";

export type EvidenceReference = Readonly<{ code: string; reference: string; description?: string }>;
export type TransitionOutcome = "APPROVED" | "REJECTED";
export type TransitionStoreError = "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "CRITERIA_NOT_CONFIGURED" | "NOT_ELIGIBLE" | "IDEMPOTENCY_CONFLICT";
type WriteInput = Readonly<{ actorAccountId:string; idempotencyKey:string; requestHash:Buffer; subjectHash:Buffer; correlationId:string; now:Date }>;

export type CriteriaConfigured = Readonly<{ programVersionId:string; criteria:PromotionCriteria; replayed:boolean }>;
export type PromotionDecisionResult = Readonly<{ promotionDecisionId:string; enrollmentId:string; membershipId:string; outcome:TransitionOutcome; eligible:boolean; memberCondition:"ASPIRANT"|"COLPORTOR"; replayed:boolean }>;
export type ExperienceRecognitionResult = Readonly<{ experienceRecognitionId:string; membershipId:string; outcome:TransitionOutcome; memberCondition:"ASPIRANT"|"COLPORTOR"; replayed:boolean }>;
export type TransitionHistory = Readonly<{membershipId:string;memberCondition:"ASPIRANT"|"COLPORTOR";events:readonly Readonly<{conditionEventId:string;previousCondition:"ASPIRANT"|"COLPORTOR"|null;newCondition:"ASPIRANT"|"COLPORTOR";transitionMethod:"INITIAL_REGISTRATION"|"TRAINING_COMPLETION"|"PRIOR_EXPERIENCE_RECOGNITION"|"ADMIN_CORRECTION";reason:string|null;evidence:unknown;actorAccountId:string|null;occurredAt:Date}>[]}>;

export interface MemberTransitionStore {
  configureCriteria(input: WriteInput & Readonly<{ programVersionId:string; criteria:PromotionCriteria }>): Promise<CriteriaConfigured|TransitionStoreError>;
  decidePromotion(input: WriteInput & Readonly<{ promotionDecisionId:string; conditionEventId:string; enrollmentId:string; outcome:TransitionOutcome; reason:string; evidence:readonly EvidenceReference[] }>): Promise<PromotionDecisionResult|TransitionStoreError>;
  decideExperienceRecognition(input: WriteInput & Readonly<{ experienceRecognitionId:string; conditionEventId:string; membershipId:string; outcome:TransitionOutcome; reason:string; experienceSummary:string; evidence:readonly EvidenceReference[] }>): Promise<ExperienceRecognitionResult|TransitionStoreError>;
  readHistory(input:Readonly<{actorAccountId:string;membershipId:string}>):Promise<TransitionHistory|"FORBIDDEN"|"NOT_FOUND">;
}
