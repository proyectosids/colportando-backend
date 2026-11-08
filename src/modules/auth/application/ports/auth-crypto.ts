import type { ActionPurpose } from "./auth-store.js";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string | null): Promise<boolean>;
}

export interface AuthTokenCodec {
  createOpaqueToken(): string;
  hashOpaqueToken(token: string): Buffer;
  issueAccessToken(input: Readonly<{ accountId: string; sessionId: string; expiresAt: Date }>): Promise<string>;
  verifyAccessToken(token: string): Promise<Readonly<{ accountId: string; sessionId: string }>>;
}

export interface ActionTokenDelivery {
  deliver(input: Readonly<{ purpose: ActionPurpose; email: string; token: string; expiresAt: Date }>): Promise<void>;
}
