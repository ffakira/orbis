import express, { type Response } from "express";

import { createRequireAuthentication } from "#delivery/http/middleware/require-authentication.js";
import { InvalidCredentialsError } from "#modules/identity/application/commands/login.handler.js";
import {
  loginSchema,
  type LoginCommand,
} from "#modules/identity/application/commands/login.schema.js";
import {
  registerUserSchema,
  type RegisterUserCommand,
} from "#modules/identity/application/commands/register-user.schema.js";
import { RequestPasswordRecoveryResult } from "#modules/identity/application/commands/request-password-recovery.handler.js";
import {
  RequestPasswordRecoveryCommand,
  requestPasswordRecoverySchema,
} from "#modules/identity/application/commands/request-password-recovery.schema.js";
import {
  verifyEmailSchema,
  type VerifyEmailCommand,
} from "#modules/identity/application/commands/verify-email.schema.js";
import { EmailAlreadyRegisteredError } from "#modules/identity/application/email-already-registered.error.js";
import { InvalidEmailVerificationTokenError } from "#modules/identity/application/invalid-email-verification-token.error.js";
import { UserProfileNotFoundError } from "#modules/identity/application/queries/get-user-profile.handler.js";

import type { LoginResult } from "#modules/identity/application/commands/login.handler.js";
import type { RegisterUserResult } from "#modules/identity/application/commands/register-user.handler.js";
import type { VerifyEmailResult } from "#modules/identity/application/commands/verify-email.handler.js";
import type { AccessTokenVerifier } from "#modules/identity/application/ports/access-token-verifier.js";
import type { UserProfile } from "#modules/identity/application/ports/user-profile-repository.js";

export interface LoginHandlerContract {
  execute(command: LoginCommand): Promise<LoginResult>;
}

export interface RegistrationHandler {
  execute(command: RegisterUserCommand): Promise<RegisterUserResult>;
}

export interface EmailVerificationHandler {
  execute(command: VerifyEmailCommand): Promise<VerifyEmailResult>;
}

export interface UserProfileHandlerContract {
  execute(userId: string): Promise<UserProfile>;
}

export interface ActiveUserHandlerContract {
  execute(userId: string): Promise<void>;
}

export interface RequestPasswordRecoveryHandlerContract {
  execute(
    command: RequestPasswordRecoveryCommand,
  ): Promise<RequestPasswordRecoveryResult>;
}

export interface IdentityHttpDependencies {
  getLoginHandler: () => Promise<LoginHandlerContract>;
  getRegisterUserHandler: () => Promise<RegistrationHandler>;
  getVerifyEmailHandler: () => Promise<EmailVerificationHandler>;
  getAccessTokenVerifier: () => Promise<AccessTokenVerifier>;
  getUserProfileHandler: () => Promise<UserProfileHandlerContract>;
  getActiveUserHandler: () => Promise<ActiveUserHandlerContract>;
  getRequestPasswordRecoveryHandler: () => Promise<RequestPasswordRecoveryHandlerContract>;
}

export function createIdentityRouter(dependencies: IdentityHttpDependencies) {
  const router = express.Router();

  const requireAuthentication = createRequireAuthentication({
    getAccessTokenVerifier: dependencies.getAccessTokenVerifier,
    getActiveUserHandler: dependencies.getActiveUserHandler,
  });

  router.get(
    "/me",
    requireAuthentication,
    async (_req, res: Response<unknown, { auth: { userId: string } }>) => {
      try {
        const userId = res.locals.auth.userId;
        const handler = await dependencies.getUserProfileHandler();
        const profile = await handler.execute(userId);

        return res.status(200).json({
          user: profile,
        });
      } catch (error) {
        if (error instanceof UserProfileNotFoundError) {
          return res.status(401).json({
            error: "UNAUTHENTICATED",
            message: "The authenticated user is no longer available.",
          });
        }

        console.error(
          "Retrieving authenticated user profile failed:",
          error instanceof Error ? error.name : "UnknownError",
        );

        return res.status(500).json({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  router.post("/login", async (req, res) => {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "The login data is invalid.",
        issues: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    try {
      const handler = await dependencies.getLoginHandler();
      const result = await handler.execute(validation.data);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return res.status(401).json({
          error: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        });
      }

      console.error(
        "User login failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
    }
  });

  router.post("/register", async (req, res) => {
    const validation = registerUserSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "The registration data is invalid.",
        issues: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    try {
      const handler = await dependencies.getRegisterUserHandler();
      const result = await handler.execute(validation.data);

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return res.status(409).json({
          error: "EMAIL_ALREADY_REGISTERED",
          message: error.message,
        });
      }

      console.error(
        "User registration failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
    }
  });

  router.post("/verify-email", async (req, res) => {
    const validation = verifyEmailSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "The verification request is invalid.",
        issues: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    try {
      const handler = await dependencies.getVerifyEmailHandler();
      const result = await handler.execute(validation.data);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof InvalidEmailVerificationTokenError) {
        return res.status(400).json({
          error: "INVALID_EMAIL_VERIFICATION_TOKEN",
          message: "The verification token is invalid or has expired.",
        });
      }

      console.error(
        "Email verification failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
    }
  });

  router.post("/password-recovery", async (req, res) => {
    const validation = requestPasswordRecoverySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "The password recovery data is invalid.",
        issues: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }

    try {
      const handler = await dependencies.getRequestPasswordRecoveryHandler();
      const result = await handler.execute(validation.data);

      return res.status(200).json(result);
    } catch (error) {
      console.error(
        "Password recovery request failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
    }
  });

  return router;
}
