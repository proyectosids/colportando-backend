import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../shared/presentation/http/errors/app-error.js";
import type { PromotionCriteria } from "../domain/promotion-criteria.js";
import type { EvidenceReference, MemberTransitionStore, TransitionOutcome, TransitionStoreError } from "./ports/member-transition-store.js";

const digest=(value:unknown):Buffer=>createHash("sha256").update(JSON.stringify(value)).digest();
const normalize=(value:string):string=>value.trim().replace(/\s+/g," ");
const subject=(actor:string):Buffer=>digest({actor:actor.toLowerCase()});

export class MemberTransitionService {
  public constructor(private readonly store:MemberTransitionStore,private readonly now:()=>Date=()=>new Date()){}

  public configureCriteria(input:Readonly<{actorAccountId:string;programVersionId:string;criteria:PromotionCriteria;idempotencyKey:string;correlationId:string}>){
    const canonical={programVersionId:input.programVersionId.toLowerCase(),criteria:input.criteria};
    return this.unwrap(this.store.configureCriteria({...input,requestHash:digest(canonical),subjectHash:subject(input.actorAccountId),now:this.now()}));
  }

  public decidePromotion(input:Readonly<{actorAccountId:string;enrollmentId:string;outcome:TransitionOutcome;reason:string;evidence:readonly EvidenceReference[];idempotencyKey:string;correlationId:string}>){
    const canonical={enrollmentId:input.enrollmentId.toLowerCase(),outcome:input.outcome,reason:normalize(input.reason),evidence:input.evidence};
    return this.unwrap(this.store.decidePromotion({actorAccountId:input.actorAccountId,enrollmentId:input.enrollmentId,outcome:input.outcome,reason:canonical.reason,evidence:input.evidence,promotionDecisionId:randomUUID(),conditionEventId:randomUUID(),idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,requestHash:digest(canonical),subjectHash:subject(input.actorAccountId),now:this.now()}));
  }

  public decideExperienceRecognition(input:Readonly<{actorAccountId:string;membershipId:string;outcome:TransitionOutcome;reason:string;experienceSummary:string;evidence:readonly EvidenceReference[];idempotencyKey:string;correlationId:string}>){
    const canonical={membershipId:input.membershipId.toLowerCase(),outcome:input.outcome,reason:normalize(input.reason),experienceSummary:normalize(input.experienceSummary),evidence:input.evidence};
    return this.unwrap(this.store.decideExperienceRecognition({actorAccountId:input.actorAccountId,membershipId:input.membershipId,outcome:input.outcome,reason:canonical.reason,experienceSummary:canonical.experienceSummary,evidence:input.evidence,experienceRecognitionId:randomUUID(),conditionEventId:randomUUID(),idempotencyKey:input.idempotencyKey,correlationId:input.correlationId,requestHash:digest(canonical),subjectHash:subject(input.actorAccountId),now:this.now()}));
  }

  public async getHistory(actorAccountId:string,membershipId:string){
    const result=await this.store.readHistory({actorAccountId,membershipId});
    if(result==="FORBIDDEN") throw new AppError(403,"TRANSITION_HISTORY_FORBIDDEN","Account lacks permission to read this membership history");
    if(result==="NOT_FOUND") throw new AppError(404,"MEMBER_TRANSITION_NOT_FOUND","Membership was not found");
    return {...result,events:result.events.map((event)=>({...event,occurredAt:event.occurredAt.toISOString()}))};
  }

  private async unwrap<T>(promise:Promise<T|TransitionStoreError>):Promise<T>{
    const result=await promise;
    if(typeof result!=="string") return result;
    const errors:Record<TransitionStoreError,readonly[number,string,string]>= {
      FORBIDDEN:[403,"MEMBER_TRANSITION_FORBIDDEN","Account lacks the required tenant-bound permission"],
      NOT_FOUND:[404,"MEMBER_TRANSITION_NOT_FOUND","Enrollment or membership was not found"],
      CONFLICT:[409,"MEMBER_TRANSITION_CONFLICT","Membership or decision conflicts with its current state"],
      CRITERIA_NOT_CONFIGURED:[409,"PROMOTION_CRITERIA_NOT_CONFIGURED","Promotion criteria are not configured for this program version"],
      NOT_ELIGIBLE:[409,"PROMOTION_NOT_ELIGIBLE","Configured promotion criteria or evidence requirements are not satisfied"],
      IDEMPOTENCY_CONFLICT:[409,"IDEMPOTENCY_KEY_REUSED","Idempotency key was already used for a different request"]
    };
    const [status,code,message]=errors[result as TransitionStoreError]; throw new AppError(status,code,message);
  }
}
