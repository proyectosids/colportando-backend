export type WorkspaceError = "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IDEMPOTENCY_CONFLICT";
export type WorkspaceContext = Readonly<{
  accountId: string;
  email: string;
  clubs: ReadonlyArray<{
    tenantId: string;
    institutionId: string;
    institutionName: string;
    clubId: string;
    clubName: string;
    membership: null | { membershipId: string; status: "PENDING" | "ACTIVE" | "SUSPENDED" | "ENDED"; condition: "ASPIRANT" | "COLPORTOR" };
    roles: ReadonlyArray<{ code: string; name: string; scopeType: "PLATFORM" | "INSTITUTION" | "CLUB" }>;
    permissions: string[];
    associateGroupIds: string[];
  }>;
}>;
export type Page<T> = Readonly<{ items: T[]; page: number; pageSize: number; total: number }>;
export type MembershipSummary = Readonly<{ accountId: string | null; membershipId: string; personId: string; displayName: string; email: string | null; membershipStatus: string; memberCondition: string }>;
export type CampaignSummary = Readonly<{ campaignId: string; name: string; startsOn: string; endsOn: string; status: string; participantCount: number; groupCount: number }>;
export type TrainingProgramSummary = Readonly<{ programId: string; code: string; name: string; status: string; activeVersionId: string | null; activeVersionLabel: string | null }>;
export type GroupSummary = Readonly<{ groupId: string; name: string; status: string; associateParticipationId: string | null; participantCount: number; fieldCount: number }>;
export type RoleSummary = Readonly<{ roleId: string; code: string; name: string; scopeType: "CLUB" }>;
export type AccessAssignmentResult = Readonly<{ accessAssignmentId: string; accountId: string; roleCode: string; clubId: string; status: "ACTIVE" | "REVOKED"; replayed: boolean }>;

export interface WorkspaceStore {
  getContext(accountId: string): Promise<WorkspaceContext>;
  listMemberships(input: Readonly<{ actorAccountId: string; clubId: string; page: number; pageSize: number; search?: string }>): Promise<Page<MembershipSummary> | WorkspaceError>;
  listCampaigns(input: Readonly<{ actorAccountId: string; clubId: string; page: number; pageSize: number }>): Promise<Page<CampaignSummary> | WorkspaceError>;
  listCampaignGroups(input: Readonly<{ actorAccountId: string; campaignId: string; page: number; pageSize: number }>): Promise<Page<GroupSummary> | WorkspaceError>;
  listTrainingPrograms(input: Readonly<{ actorAccountId: string; clubId: string; page: number; pageSize: number }>): Promise<Page<TrainingProgramSummary> | WorkspaceError>;
  listAssignableRoles(input: Readonly<{ actorAccountId: string; clubId: string }>): Promise<RoleSummary[] | WorkspaceError>;
  assignClubAccess(input: Readonly<{ accessAssignmentId: string; actorAccountId: string; accountId: string; clubId: string; roleCode: string; reason?: string; idempotencyKey: string; requestHash: Buffer; subjectHash: Buffer; correlationId: string; now: Date }>): Promise<AccessAssignmentResult | WorkspaceError>;
  revokeClubAccess(input: Readonly<{ actorAccountId: string; accessAssignmentId: string; reason: string; idempotencyKey: string; requestHash: Buffer; subjectHash: Buffer; correlationId: string; now: Date }>): Promise<AccessAssignmentResult | WorkspaceError>;
}
