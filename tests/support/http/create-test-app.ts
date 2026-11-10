import { vi } from "vitest";

import { InvalidAccessTokenError } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";
import { createApp } from "#presentation/http/app.js";

import type { LoginResult } from "#modules/identity/application/commands/login.handler.js";
import type { RegisterUserResult } from "#modules/identity/application/commands/register-user.handler.js";
import type { RequestPasswordRecoveryResult } from "#modules/identity/application/commands/request-password-recovery.handler.js";
import type { VerifyEmailResult } from "#modules/identity/application/commands/verify-email.handler.js";
import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from "#modules/identity/application/ports/access-token-verifier.js";
import type { UserProfile } from "#modules/identity/application/ports/user-profile-repository.js";
import type { CreateRestaurantResult } from "#modules/restaurants/application/commands/create-restaurant.handler.js";
import type { DatabaseReadiness } from "#presentation/http/app.js";
import type {
  ActiveUserHandlerContract,
  ConfirmPasswordRecoveryHandlerContract,
  EmailVerificationHandler,
  IdentityHttpDependencies,
  LoginHandlerContract,
  RegistrationHandler,
  RequestPasswordRecoveryHandlerContract,
  UserProfileHandlerContract,
} from "#presentation/http/identity.http.js";
import type {
  CreateRestaurantHandlerContract,
  GetUserRestaurantsHandlerContract,
} from "#presentation/http/restaurants.http.js";

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_RESTAURANT_ID = "00000000-0000-4000-8000-000000000002";
export const TEST_TOKEN_VERSION = 0;
export const TEST_ACCESS_TOKEN = "synthetic-valid-access-token";

export const TEST_LOGIN_RESULT: LoginResult = {
  accessToken: "synthetic-access-token",
  tokenType: "Bearer",
  expiresAt: "2026-11-07T10:15:00.000Z",
};

export const TEST_USER_PROFILE: UserProfile = {
  userId: TEST_USER_ID,
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "+15555550100",
  status: "active",
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
};

export const TEST_VERIFIED_ACCESS_TOKEN: VerifiedAccessToken = {
  userId: TEST_USER_ID,
  tokenVersion: TEST_TOKEN_VERSION,
  issuedAt: new Date("2026-01-15T10:00:00.000Z"),
  expiresAt: new Date("2026-01-15T10:15:00.000Z"),
};

export interface CreateTestAppOptions {
  restaurants?: boolean;
}

export function createTestApp(options: CreateTestAppOptions = {}) {
  const loginExecute = vi.fn<LoginHandlerContract["execute"]>(
    async () => TEST_LOGIN_RESULT,
  );

  const getLoginHandler = vi.fn<IdentityHttpDependencies["getLoginHandler"]>(
    async () => ({ execute: loginExecute }),
  );

  const registrationExecute = vi.fn<RegistrationHandler["execute"]>(
    async (): Promise<RegisterUserResult> => ({
      userId: TEST_USER_ID,
    }),
  );

  const getRegisterUserHandler = vi.fn<
    IdentityHttpDependencies["getRegisterUserHandler"]
  >(async () => ({ execute: registrationExecute }));

  const verifyEmailExecute = vi.fn<EmailVerificationHandler["execute"]>(
    async (): Promise<VerifyEmailResult> => ({
      verified: true,
    }),
  );

  const getVerifyEmailHandler = vi.fn<
    IdentityHttpDependencies["getVerifyEmailHandler"]
  >(async () => ({ execute: verifyEmailExecute }));

  const verifyAccessToken = vi.fn<AccessTokenVerifier["verify"]>(
    async (token) => {
      if (token !== TEST_ACCESS_TOKEN) {
        throw new InvalidAccessTokenError();
      }

      return TEST_VERIFIED_ACCESS_TOKEN;
    },
  );

  const getAccessTokenVerifier = vi.fn<
    IdentityHttpDependencies["getAccessTokenVerifier"]
  >(async () => ({
    verify: verifyAccessToken,
  }));

  const activeUserExecute = vi.fn<ActiveUserHandlerContract["execute"]>(
    async () => {},
  );

  const getActiveUserHandler = vi.fn<
    IdentityHttpDependencies["getActiveUserHandler"]
  >(async () => ({
    execute: activeUserExecute,
  }));

  const userProfileExecute = vi.fn<UserProfileHandlerContract["execute"]>(
    async () => TEST_USER_PROFILE,
  );

  const getUserProfileHandler = vi.fn<
    IdentityHttpDependencies["getUserProfileHandler"]
  >(async () => ({
    execute: userProfileExecute,
  }));

  const requestPasswordRecoveryExecute = vi.fn<
    RequestPasswordRecoveryHandlerContract["execute"]
  >(async (): Promise<RequestPasswordRecoveryResult> => ({
    requested: true,
  }));

  const getRequestPasswordRecoveryHandler = vi.fn<
    IdentityHttpDependencies["getRequestPasswordRecoveryHandler"]
  >(async () => ({
    execute: requestPasswordRecoveryExecute,
  }));

  const confirmPasswordRecoveryExecute = vi.fn<
    ConfirmPasswordRecoveryHandlerContract["execute"]
  >(async () => ({
    passwordReset: true,
  }));

  const getConfirmPasswordRecoveryHandler = vi.fn<
    IdentityHttpDependencies["getConfirmPasswordRecoveryHandler"]
  >(async () => ({
    execute: confirmPasswordRecoveryExecute,
  }));

  const createRestaurantExecute = vi.fn<
    CreateRestaurantHandlerContract["execute"]
  >(async (): Promise<CreateRestaurantResult> => ({
    restaurantId: TEST_RESTAURANT_ID,
  }));

  const getCreateRestaurantHandler = vi.fn<
    () => Promise<CreateRestaurantHandlerContract>
  >(async () => ({
    execute: createRestaurantExecute,
  }));

  const userRestaurantsExecute = vi.fn<
    GetUserRestaurantsHandlerContract["execute"]
  >(async () => []);

  const getUserRestaurantsHandler = vi.fn<
    () => Promise<GetUserRestaurantsHandlerContract>
  >(async () => ({
    execute: userRestaurantsExecute,
  }));

  const checkDatabaseReadiness = vi.fn(
    async (): Promise<DatabaseReadiness> => ({
      database: "test_database",
      username: "test_user",
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
  );

  const identity: IdentityHttpDependencies = {
    getLoginHandler,
    getRegisterUserHandler,
    getVerifyEmailHandler,
    getAccessTokenVerifier,
    getUserProfileHandler,
    getActiveUserHandler,
    getRequestPasswordRecoveryHandler,
    getConfirmPasswordRecoveryHandler,
  };

  const app = createApp({
    identity,
    ...(options.restaurants
      ? {
          restaurants: {
            getCreateRestaurantHandler,
            getUserRestaurantsHandler,
            getAccessTokenVerifier,
            getActiveUserHandler,
          },
        }
      : {}),
    checkDatabaseReadiness,
  });

  return {
    app,
    mocks: {
      identity: {
        login: {
          execute: loginExecute,
          getHandler: getLoginHandler,
        },
        registration: {
          execute: registrationExecute,
          getHandler: getRegisterUserHandler,
        },
        emailVerification: {
          execute: verifyEmailExecute,
          getHandler: getVerifyEmailHandler,
        },
        accessTokenVerifier: {
          verify: verifyAccessToken,
          getVerifier: getAccessTokenVerifier,
        },
        activeUser: {
          execute: activeUserExecute,
          getHandler: getActiveUserHandler,
        },
        userProfile: {
          execute: userProfileExecute,
          getHandler: getUserProfileHandler,
        },
        passwordRecovery: {
          execute: requestPasswordRecoveryExecute,
          getHandler: getRequestPasswordRecoveryHandler,
        },
        passwordRecoveryConfirmation: {
          execute: confirmPasswordRecoveryExecute,
          getHandler: getConfirmPasswordRecoveryHandler,
        },
      },
      restaurants: {
        create: {
          execute: createRestaurantExecute,
          getHandler: getCreateRestaurantHandler,
        },
        list: {
          execute: userRestaurantsExecute,
          getHandler: getUserRestaurantsHandler,
        },
      },
      databaseReadiness: checkDatabaseReadiness,
    },
  };
}
