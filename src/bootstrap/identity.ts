import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import { getEmailVerificationSecret } from "../infrastructure/secrets/secrets-manager.js";

import { RegisterUserHandler } from "../modules/identity/application/commands/register-user.handler.js";

import type { Clock } from "../modules/identity/application/ports/clock.js";
import type { IdGenerator } from "../modules/identity/application/ports/id-generator.js";
import type { TermsPolicy } from "../modules/identity/application/ports/terms-policy.js";

import { getDatabase } from "../infrastructure/database/client.js";
import { DrizzleIdentityUnitOfWork } from "../modules/identity/infrastructure/persistence/drizzle-identity-unit-of-work.js";
import { Argon2PasswordHasher } from "../modules/identity/infrastructure/cryptography/argon2-password-hasher.js";
import { HmacEmailVerificationTokenSigner } from "../modules/identity/infrastructure/cryptography/hmac-email-verification-token-signer.js";

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

    const [db, emailVerificationSecret] = await Promise.all([
      getDatabase(),
      getEmailVerificationSecret(),
    ]);

    return new RegisterUserHandler({
      ids: new UuidGenerator(),
      clock: new SystemClock(),
      passwordHasher: new Argon2PasswordHasher(),
      termsPolicy: new ConfiguredTermsPolicy(termsVersion),
      emailVerificationTokenSigner: new HmacEmailVerificationTokenSigner(
        emailVerificationSecret.EMAIL_VERIFICATION_SECRET,
      ),
      unitOfWork: new DrizzleIdentityUnitOfWork(db),
    });
  })().catch((error: unknown) => {
    handlerPromise = undefined;
    throw error;
  });

  return handlerPromise;
}
