import { randomUUID } from "node:crypto";

import { env } from "#config/env.js";
import {
  getAuthenticationSecret,
  getEmailVerificationSecret,
} from "#infrastructure/secrets/secrets-manager.js";
import { getDatabase } from "#infrastructure/database/client.js";

import { LoginHandler } from "#modules/identity/application/commands/login.handler.js";
import { RegisterUserHandler } from "#modules/identity/application/commands/register-user.handler.js";
import { VerifyEmailHandler } from "#modules/identity/application/commands/verify-email.handler.js";
import { GetUserProfileHandler } from "#modules/identity/application/queries/get-user-profile.handler.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { IdGenerator } from "#modules/identity/application/ports/id-generator.js";
import type { TermsPolicy } from "#modules/identity/application/ports/terms-policy.js";

import { Argon2PasswordHasher } from "#modules/identity/infrastructure/cryptography/argon2-password-hasher.js";
import { HmacEmailVerificationTokenSigner } from "#modules/identity/infrastructure/cryptography/hmac-email-verification-token-signer.js";
import { JoseAccessTokenIssuer } from "#modules/identity/infrastructure/cryptography/jose-access-token-issuer.js";
import { JoseAccessTokenVerifier } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";
import { DrizzleAuthenticationUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-authentication-user-repository.js";
import { DrizzleUserProfileRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-user-profile-repository.js";
import { DrizzleIdentityUnitOfWork } from "#modules/identity/infrastructure/persistence/drizzle-identity-unit-of-work.js";

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

const clock = new SystemClock();

let dependenciesPromise:
  | Promise<{
      unitOfWork: DrizzleIdentityUnitOfWork;
      emailVerificationTokenSigner: HmacEmailVerificationTokenSigner;
    }>
  | undefined;

function getIdentityDependencies() {
  dependenciesPromise ??= (async () => {
    const [db, emailVerificationSecret] = await Promise.all([
      getDatabase(),
      getEmailVerificationSecret(),
    ]);

    return {
      unitOfWork: new DrizzleIdentityUnitOfWork(db),
      emailVerificationTokenSigner: new HmacEmailVerificationTokenSigner(
        emailVerificationSecret.EMAIL_VERIFICATION_SECRET,
      ),
    };
  })().catch((error: unknown) => {
    dependenciesPromise = undefined;
    throw error;
  });

  return dependenciesPromise;
}

let registerUserHandlerPromise: Promise<RegisterUserHandler> | undefined;

export function getRegisterUserHandler(): Promise<RegisterUserHandler> {
  registerUserHandlerPromise ??= (async () => {
    const termsVersion = env.termsOfServiceVersion;

    if (!termsVersion) {
      throw new Error("TERMS_OF_SERVICE_VERSION is not configured.");
    }

    const dependencies = await getIdentityDependencies();

    return new RegisterUserHandler({
      ids: new UuidGenerator(),
      clock,
      passwordHasher: new Argon2PasswordHasher(),
      termsPolicy: new ConfiguredTermsPolicy(termsVersion),
      ...dependencies,
    });
  })().catch((error: unknown) => {
    registerUserHandlerPromise = undefined;
    throw error;
  });

  return registerUserHandlerPromise;
}

let verifyEmailHandlerPromise: Promise<VerifyEmailHandler> | undefined;

export function getVerifyEmailHandler(): Promise<VerifyEmailHandler> {
  verifyEmailHandlerPromise ??= (async () => {
    const dependencies = await getIdentityDependencies();

    return new VerifyEmailHandler({
      clock,
      ...dependencies,
    });
  })().catch((error: unknown) => {
    verifyEmailHandlerPromise = undefined;
    throw error;
  });

  return verifyEmailHandlerPromise;
}

let loginHandlerPromise: Promise<LoginHandler> | undefined;

export function getLoginHandler(): Promise<LoginHandler> {
  loginHandlerPromise ??= (async () => {
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
  })().catch((error: unknown) => {
    loginHandlerPromise = undefined;
    throw error;
  });

  return loginHandlerPromise;
}

let accessTokenVerifierPromise: Promise<JoseAccessTokenVerifier> | undefined;

export function getAccessTokenVerifier(): Promise<JoseAccessTokenVerifier> {
  accessTokenVerifierPromise ??= (async () => {
    const authenticationSecret = await getAuthenticationSecret();

    return new JoseAccessTokenVerifier(authenticationSecret.JWT_SECRET);
  })().catch((error: unknown) => {
    accessTokenVerifierPromise = undefined;
    throw error;
  });

  return accessTokenVerifierPromise;
}

let userProfileHandlerPromise: Promise<GetUserProfileHandler> | undefined;

export function getUserProfileHandler(): Promise<GetUserProfileHandler> {
  userProfileHandlerPromise ??= (async () => {
    const db = await getDatabase();

    return new GetUserProfileHandler({
      userProfiles: new DrizzleUserProfileRepository(db),
    });
  })().catch((error: unknown) => {
    userProfileHandlerPromise = undefined;
    throw error;
  });

  return userProfileHandlerPromise;
}
