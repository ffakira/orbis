import argon2 from "argon2";

import type { PasswordHasher } from "../../application/ports/password-hasher.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plainTextPassword: string): Promise<string> {
    return argon2.hash(plainTextPassword, ARGON2_OPTIONS);
  }

  async verify(
    plainTextPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainTextPassword);
    } catch {
      return false;
    }
  }
}
