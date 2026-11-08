import express from "express";

import {
  createIdentityRouter,
  type IdentityHttpDependencies,
} from "#delivery/http/identity.http.js";

export interface DatabaseReadiness {
  database: string;
  username: string;
  connectedAt: Date;
}

export interface AppDependencies {
  identity: IdentityHttpDependencies;
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

  app.use("/identity", createIdentityRouter(dependencies.identity));

  return app;
}
