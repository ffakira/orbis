import express from "express";

import type { RegisterUserResult } from "../../modules/identity/application/commands/register-user.handler.js";
import type { VerifyEmailResult } from "../../modules/identity/application/commands/verify-email.handler.js";

import {
  registerUserSchema,
  type RegisterUserCommand,
} from "../../modules/identity/application/commands/register-user.schema.js";

import {
  verifyEmailSchema,
  type VerifyEmailCommand,
} from "../../modules/identity/application/commands/verify-email.schema.js";

import { EmailAlreadyRegisteredError } from "../../modules/identity/application/email-already-registered.error.js";
import { InvalidEmailVerificationTokenError } from "../../modules/identity/application/invalid-email-verification-token.error.js";

export interface RegistrationHandler {
  execute(command: RegisterUserCommand): Promise<RegisterUserResult>;
}

export interface EmailVerificationHandler {
  execute(command: VerifyEmailCommand): Promise<VerifyEmailResult>;
}

export interface DatabaseReadiness {
  database: string;
  username: string;
  connectedAt: Date;
}

export interface AppDependencies {
  getRegisterUserHandler: () => Promise<RegistrationHandler>;
  getVerifyEmailHandler: () => Promise<EmailVerificationHandler>;
  checkDatabaseReadiness: () => Promise<DatabaseReadiness>;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    return res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (_req, res) => {
    try {
      const database = await dependencies.checkDatabaseReadiness();

      return res.status(200).json({
        status: "ok",
        database: database.database,
        username: database.username,
        connectedAt: database.connectedAt,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Database readiness check failed:",
        error instanceof Error ? error.message : "Unknown error",
      );

      return res.status(503).json({
        status: "error",
        message: "Database is unavailable",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/identity/register", async (req, res) => {
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

  app.post("/identity/verify-email", async (req, res) => {
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

  return app;
}
