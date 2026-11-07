import { randomUUID } from "node:crypto";
import argon2 from "argon2";

import { env } from "../../config/env.js";
import { RegisterUserHandler } from "../../modules/identity/application/commands/register-user.handler.js";

import { getDatabase } from "../database/client.js";
import { DrizzleIdentityUnitOfWork } from "../database/identity/drizzle-identity-unit-of-work.js";

import type { Clock } from "../../modules/identity/application/ports/clock.js";
import type { IdGenerator } from "../../modules/identity/application/ports/id-generator.js";
import type { PasswordHasher } from "../../modules/identity/application/ports/password-hasher.js";
import type { TermsPolicy } from "../../modules/identity/application/ports/terms-policy.js";

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

class Argon2PasswordHasher implements PasswordHasher {
  hash(plainTextPassword: string): Promise<string> {
    return argon2.hash(plainTextPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}

class ConfiguredTermsPolicy implements TermsPolicy {
  constructor(private readonly version: string) {
    if (!version.trim() || version.length > 64) {
      throw new Error(
        "TERMS_OF_SERVICE_VERSION must contain between 1 and 64 characters.",
      );
    }
  }

  currentTermsOfServiceVersion(): string {
    return this.version;
  }
}

let handlerPromise: Promise<RegisterUserHandler> | undefined;

export function getRegisterUserHandler(): Promise<RegisterUserHandler> {
  handlerPromise ??= (async () => {
    const termsVersion = env.termsOfServiceVersion;

    if (!termsVersion) {
      throw new Error("TERMS_OF_SERVICE_VERSION is not configured.");
    }

    const db = await getDatabase();

    return new RegisterUserHandler({
      ids: new UuidGenerator(),
      clock: new SystemClock(),
      passwordHasher: new Argon2PasswordHasher(),
      termsPolicy: new ConfiguredTermsPolicy(termsVersion),
      unitOfWork: new DrizzleIdentityUnitOfWork(db),
    });
  })().catch((error: unknown) => {
    handlerPromise = undefined;
    throw error;
  });

  return handlerPromise;
}
