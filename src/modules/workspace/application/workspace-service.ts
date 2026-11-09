import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../shared/presentation/http/errors/app-error.js";
import type { WorkspaceError, WorkspaceStore } from "./ports/workspace-store.js";

const hash = (value: unknown): Buffer => createHash("sha256").update(JSON.stringify(value)).digest();
export class WorkspaceService {
  public constructor(private readonly store: WorkspaceStore, private readonly now: () => Date = () => new Date()) {}
  public getContext(accountId: string) { return this.store.getContext(accountId); }
  public listMemberships(actorAccountId: string, clubId: string, page: number, pageSize: number, search?: string) { return this.unwrap(this.store.listMemberships({ actorAccountId, clubId, page, pageSize, ...(search === undefined ? {} : { search: search.trim() }) })); }
  public listCampaigns(actorAccountId: string, clubId: string, page: number, pageSize: number) { return this.unwrap(this.store.listCampaigns({ actorAccountId, clubId, page, pageSize })); }
  public listCampaignGroups(actorAccountId: string, campaignId: string, page: number, pageSize: number) { return this.unwrap(this.store.listCampaignGroups({ actorAccountId, campaignId, page, pageSize })); }
  public listTrainingPrograms(actorAccountId: string, clubId: string, page: number, pageSize: number) { return this.unwrap(this.store.listTrainingPrograms({ actorAccountId, clubId, page, pageSize })); }
  public listAssignableRoles(actorAccountId: string, clubId: string) { return this.unwrap(this.store.listAssignableRoles({ actorAccountId, clubId })); }
  public assignClubAccess(input: Readonly<{ actorAccountId: string; accountId: string; clubId: string; roleCode: string; reason?: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { accountId: input.accountId.toLowerCase(), clubId: input.clubId.toLowerCase(), roleCode: input.roleCode.toUpperCase(), reason: input.reason?.trim() ?? null };
    return this.unwrap(this.store.assignClubAccess({ accessAssignmentId: randomUUID(), actorAccountId: input.actorAccountId, accountId: input.accountId, clubId: input.clubId, roleCode: canonical.roleCode, ...(canonical.reason === null ? {} : { reason: canonical.reason }), ...this.writeContext(input, canonical) }));
  }
  public revokeClubAccess(input: Readonly<{ actorAccountId: string; accessAssignmentId: string; reason: string; idempotencyKey: string; correlationId: string }>) {
    const canonical = { accessAssignmentId: input.accessAssignmentId.toLowerCase(), reason: input.reason.trim() };
    return this.unwrap(this.store.revokeClubAccess({ actorAccountId: input.actorAccountId, accessAssignmentId: input.accessAssignmentId, reason: canonical.reason, ...this.writeContext(input, canonical) }));
  }
  private writeContext(input: Readonly<{ actorAccountId: string; idempotencyKey: string; correlationId: string }>, canonical: unknown) { return { idempotencyKey: input.idempotencyKey, correlationId: input.correlationId, requestHash: hash(canonical), subjectHash: hash({ actor: input.actorAccountId.toLowerCase() }), now: this.now() }; }
  private async unwrap<T>(promise: Promise<T | WorkspaceError>): Promise<T> {
    const result = await promise;
    if (typeof result !== "string") return result;
    const errors: Record<WorkspaceError, readonly [number, string, string]> = { FORBIDDEN: [403, "WORKSPACE_FORBIDDEN", "Account lacks the required scope or permission"], NOT_FOUND: [404, "WORKSPACE_NOT_FOUND", "Workspace resource was not found"], CONFLICT: [409, "WORKSPACE_CONFLICT", "Workspace resource conflicts with its current state"], IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request"] };
    const [status, code, message] = errors[result as WorkspaceError]; throw new AppError(status, code, message);
  }
}
