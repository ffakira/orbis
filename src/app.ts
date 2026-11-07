import express from "express";

import { getDatabasePool } from "./infrastructure/database/postgres.js";
import { getRegisterUserHandler } from "./bootstrap/identity.js";

import type { RegisterUserResult } from "./modules/identity/application/commands/register-user.handler.js";

import {
  RegisterUserCommand,
  registerUserSchema,
} from "./modules/identity/application/commands/register-user.schema.js";
import { EmailAlreadyRegisteredError } from "./modules/identity/application/email-already-registered.error.js";

interface RegistrationHandler {
  execute(command: RegisterUserCommand): Promise<RegisterUserResult>;
}

interface AppDependencies {
  getRegisterUserHandler: () => Promise<RegistrationHandler>;
}

export function createApp(
  dependencies: AppDependencies = { getRegisterUserHandler },
) {
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
      const pool = await getDatabasePool();

      const result = await pool.query<{
        database: string;
        username: string;
        connected_at: Date;
      }>(`
                SELECT
                    current_database() AS database,
                    current_user AS username,
                    NOW() AS connected_at
            `);

      const database = result.rows[0];

      if (!database) {
        throw new Error("Database readiness query returned no result.");
      }

      return res.status(200).json({
        status: "ok",
        database: database.database,
        username: database.username,
        connectedAt: database.connected_at,
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

  return app;
}

const app = createApp();

export default app;
