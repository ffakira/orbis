import { randomUUID } from "node:crypto";

import { createAsyncSingleton } from "#bootstrap/async-singleton.js";
import { env } from "#config/env.js";
import { getDatabase } from "#infrastructure/database/client.js";
import {
  getAuthenticationSecret,
  getEmailVerificationSecret,
} from "#infrastructure/secrets/secrets-manager.js";
import { SystemClock } from "#infrastructure/time/system-clock.js";
import { LoginHandler } from "#modules/identity/application/commands/login.handler.js";
import { RegisterUserHandler } from "#modules/identity/application/commands/register-user.handler.js";
import { RequestPasswordRecoveryHandler } from "#modules/identity/application/commands/request-password-recovery.handler.js";
import { VerifyEmailHandler } from "#modules/identity/application/commands/verify-email.handler.js";
import { GetActiveUserHandler } from "#modules/identity/application/queries/get-active-user.handler.js";
import { GetUserProfileHandler } from "#modules/identity/application/queries/get-user-profile.handler.js";
import { Argon2PasswordHasher } from "#modules/identity/infrastructure/cryptography/argon2-password-hasher.js";
import { HmacEmailVerificationTokenSigner } from "#modules/identity/infrastructure/cryptography/hmac-email-verification-token-signer.js";
import { HmacPasswordResetTokenSigner } from "#modules/identity/infrastructure/cryptography/hmac-password-reset-token-signer.js";
import { JoseAccessTokenIssuer } from "#modules/identity/infrastructure/cryptography/jose-access-token-issuer.js";
import { JoseAccessTokenVerifier } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";
import { DrizzleIdentityUnitOfWork } from "#modules/identity/infrastructure/persistence/drizzle-identity-unit-of-work.js";
import { DrizzleActiveUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-active-user-repository.js";
import { DrizzleAuthenticationUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-authentication-user-repository.js";
import { DrizzleUserProfileRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-user-profile-repository.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { IdGenerator } from "#modules/identity/application/ports/id-generator.js";
import type { TermsPolicy } from "#modules/identity/application/ports/terms-policy.js";

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

const clock: Clock = new SystemClock();
const ids: IdGenerator = new UuidGenerator();

const getIdentityDependencies = createAsyncSingleton(async () => {
  const [db, emailVerificationSecret] = await Promise.all([
    getDatabase(),
    getEmailVerificationSecret(),
  ]);

  return {
    unitOfWork: new DrizzleIdentityUnitOfWork(db),
    emailVerificationTokenSigner: new HmacEmailVerificationTokenSigner(
      emailVerificationSecret.EMAIL_VERIFICATION_SECRET,
    ),
    /** @todo: Introduce a dedicated PASSWORD_RESET_SECRET and Secrets Manager entry.*/
    passwordResetTokenSigner: new HmacPasswordResetTokenSigner(
      emailVerificationSecret.EMAIL_VERIFICATION_SECRET,
    ),
  };
});

export const getRegisterUserHandler = createAsyncSingleton(async () => {
  const termsVersion = env.termsOfServiceVersion;

  if (!termsVersion) {
    throw new Error("TERMS_OF_SERVICE_VERSION is not configured.");
  }

  const dependencies = await getIdentityDependencies();

  return new RegisterUserHandler({
    ids,
    clock,
    passwordHasher: new Argon2PasswordHasher(),
    termsPolicy: new ConfiguredTermsPolicy(termsVersion),
    ...dependencies,
  });
});

export const getVerifyEmailHandler = createAsyncSingleton(async () => {
  const dependencies = await getIdentityDependencies();

  return new VerifyEmailHandler({
    clock,
    ...dependencies,
  });
});

export const getLoginHandler = createAsyncSingleton(async () => {
  const [db, authenticationSecret] = await Promise.all([
    getDatabase(),
    getAuthenticationSecret(),
  ]);

  return new LoginHandler({
    authenticationUsers: new DrizzleAuthenticationUserRepository(db),
    passwordHasher: new Argon2PasswordHasher(),
    accessTokenIssuer: new JoseAccessTokenIssuer(
      authenticationSecret.JWT_SECRET,
    ),
    clock,
  });
});

export const getAccessTokenVerifier = createAsyncSingleton(async () => {
  const authenticationSecret = await getAuthenticationSecret();

  return new JoseAccessTokenVerifier(authenticationSecret.JWT_SECRET);
});

export const getUserProfileHandler = createAsyncSingleton(async () => {
  const db = await getDatabase();

  return new GetUserProfileHandler({
    userProfiles: new DrizzleUserProfileRepository(db),
  });
});

export const getActiveUserHandler = createAsyncSingleton(async () => {
  const db = await getDatabase();

  return new GetActiveUserHandler({
    activeUsers: new DrizzleActiveUserRepository(db),
  });
});

export const getRequestPasswordRecoveryHandler = createAsyncSingleton(
  async () => {
    const dependencies = await getIdentityDependencies();

    return new RequestPasswordRecoveryHandler({
      ids,
      clock,
      ...dependencies,
    });
  },
);
