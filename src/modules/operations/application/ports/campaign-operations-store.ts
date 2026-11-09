export type OperationError="FORBIDDEN"|"NOT_FOUND"|"CONFLICT"|"IDEMPOTENCY_CONFLICT";
type Write=Readonly<{actorAccountId:string;idempotencyKey:string;requestHash:Buffer;subjectHash:Buffer;correlationId:string;now:Date}>;
export type CampaignResult=Readonly<{campaignId:string;clubId:string;name:string;startsOn:string;endsOn:string;status:"PLANNED"|"ACTIVE"|"CLOSED"|"CANCELLED";replayed:boolean}>;
export type GroupResult=Readonly<{groupId:string;campaignId:string;name:string;status:"ACTIVE";replayed:boolean}>;
export type ParticipationResult=Readonly<{participationId:string;campaignId:string;membershipId:string;groupId:string;status:"ACTIVE";replayed:boolean}>;
export type AssociateResult=Readonly<{associateAssignmentId:string;groupId:string;participationId:string;status:"ACTIVE";replayed:boolean}>;
export type FieldResult=Readonly<{fieldId:string;fieldAssignmentId:string;campaignId:string;groupId:string;name:string;replayed:boolean}>;
export type ChangeRequestResult=Readonly<{groupChangeRequestId:string;participationId:string;currentGroupId:string;requestedGroupId:string;status:"SUBMITTED"|"APPROVED"|"REJECTED"|"APPEALED";replayed:boolean}>;
export type AppealResult=Readonly<{groupChangeAppealId:string;groupChangeRequestId:string;status:"SUBMITTED"|"APPROVED"|"REJECTED";replayed:boolean}>;
export type GroupOverview=Readonly<{groupId:string;campaignId:string;name:string;associateParticipationId:string|null;participants:readonly Readonly<{participationId:string;membershipId:string}>[];fields:readonly Readonly<{fieldId:string;name:string}>[]}>;
export interface CampaignOperationsStore{
 createCampaign(input:Write&Readonly<{campaignId:string;clubId:string;name:string;description?:string;startsOn:string;endsOn:string}>):Promise<CampaignResult|OperationError>;
 changeCampaignStatus(input:Write&Readonly<{campaignId:string;status:"ACTIVE"|"CLOSED"|"CANCELLED"}>):Promise<CampaignResult|OperationError>;
 createGroup(input:Write&Readonly<{groupId:string;campaignId:string;name:string;description?:string}>):Promise<GroupResult|OperationError>;
 enrollParticipation(input:Write&Readonly<{participationId:string;groupAssignmentId:string;campaignId:string;membershipId:string;groupId:string}>):Promise<ParticipationResult|OperationError>;
 assignAssociate(input:Write&Readonly<{associateAssignmentId:string;groupId:string;participationId:string;reason?:string}>):Promise<AssociateResult|OperationError>;
 createAndAssignField(input:Write&Readonly<{fieldId:string;fieldAssignmentId:string;campaignId:string;groupId:string;name:string;organization?:string;description?:string;startsOn:string;endsOn?:string}>):Promise<FieldResult|OperationError>;
 requestGroupChange(input:Write&Readonly<{groupChangeRequestId:string;participationId:string;requestedGroupId:string;reason:string}>):Promise<ChangeRequestResult|OperationError>;
 resolveGroupChange(input:Write&Readonly<{groupAssignmentId:string;groupChangeRequestId:string;outcome:"APPROVED"|"REJECTED";resolution:string}>):Promise<ChangeRequestResult|OperationError>;
 createAppeal(input:Write&Readonly<{groupChangeAppealId:string;groupChangeRequestId:string;reason:string}>):Promise<AppealResult|OperationError>;
 resolveAppeal(input:Write&Readonly<{groupAssignmentId:string;groupChangeAppealId:string;outcome:"APPROVED"|"REJECTED";resolution:string}>):Promise<AppealResult|OperationError>;
 readGroupOverview(input:Readonly<{actorAccountId:string;groupId:string}>):Promise<GroupOverview|"FORBIDDEN"|"NOT_FOUND">;
}
