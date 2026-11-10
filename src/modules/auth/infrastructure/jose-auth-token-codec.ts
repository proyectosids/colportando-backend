import { createHmac, randomBytes, randomInt } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import type { AuthTokenCodec } from "../application/ports/auth-crypto.js";

export class JoseAuthTokenCodec implements AuthTokenCodec {
  private readonly accessKey: Uint8Array;

  public constructor(
    accessSecret: string,
    private readonly tokenPepper: string,
    private readonly issuer: string,
    private readonly audience: string
  ) {
    this.accessKey = new TextEncoder().encode(accessSecret);
  }

  public createOpaqueToken(): string {
    return randomBytes(32).toString("base64url");
  }

  public createNumericCode(length: number): string {
    return Array.from({ length }, () => String(randomInt(10))).join("");
  }

  public createHumanCode(length: number): string {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
  }

  public hashOpaqueToken(token: string): Buffer {
    return createHmac("sha256", this.tokenPepper).update(token, "utf8").digest();
  }

  public issueAccessToken(input: Readonly<{ accountId: string; sessionId: string; expiresAt: Date }>): Promise<string> {
    return new SignJWT({ sid: input.sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(input.accountId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1_000))
      .sign(this.accessKey);
  }

  public async verifyAccessToken(token: string): Promise<Readonly<{ accountId: string; sessionId: string }>> {
    const result = await jwtVerify(token, this.accessKey, { issuer: this.issuer, audience: this.audience, algorithms: ["HS256"] });
    if (result.payload.sub === undefined || typeof result.payload.sid !== "string") throw new Error("Invalid access token claims");
    return { accountId: result.payload.sub, sessionId: result.payload.sid };
  }
}
