import argon2 from "argon2";

import type { PasswordHasher } from "../application/ports/auth-crypto.js";

export class ArgonPasswordHasher implements PasswordHasher {
  private readonly dummyHash = argon2.hash("not-a-real-password", { type: argon2.argon2id });

  public hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  }

  public async verify(password: string, passwordHash: string | null): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash ?? (await this.dummyHash), password);
    } catch {
      return false;
    }
  }
}
