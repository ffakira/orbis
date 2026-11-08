import express, { type Response } from "express";
import { z } from "zod";

import {
  createRequireAuthentication,
  type AuthenticatedLocals,
} from "#delivery/http/middleware/require-authentication.js";

import type { CreateRestaurantResult } from "#modules/restaurants/application/commands/create-restaurant.handler.js";
import type { CreateRestaurantCommand } from "#modules/restaurants/application/commands/create-restaurant.schema.js";

const createRestaurantRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
});

export interface CreateRestaurantHandlerContract {
  execute(command: CreateRestaurantCommand): Promise<CreateRestaurantResult>;
}

export interface RestaurantsHttpDependencies {
  getCreateRestaurantHandler: () => Promise<CreateRestaurantHandlerContract>;
  getAccessTokenVerifier: Parameters<
    typeof createRequireAuthentication
  >[0]["getAccessTokenVerifier"];
  getActiveUserHandler: Parameters<
    typeof createRequireAuthentication
  >[0]["getActiveUserHandler"];
}

export function createRestaurantsRouter(
  dependencies: RestaurantsHttpDependencies,
) {
  const router = express.Router();

  const requireAuthentication = createRequireAuthentication({
    getAccessTokenVerifier: dependencies.getAccessTokenVerifier,
    getActiveUserHandler: dependencies.getActiveUserHandler,
  });

  router.post(
    "/",
    requireAuthentication,
    async (_req, res: Response<unknown, AuthenticatedLocals>) => {
      const validation = createRestaurantRequestSchema.safeParse(_req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "The restaurant data is invalid.",
          issues: validation.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        });
      }

      try {
        const handler = await dependencies.getCreateRestaurantHandler();

        const result = await handler.execute({
          userId: res.locals.auth.userId,
          name: validation.data.name,
        });

        return res.status(201).json(result);
      } catch (error) {
        console.error(
          "Restaurant creation failed:",
          error instanceof Error ? error.name : "UnknownError",
        );

        return res.status(500).json({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  return router;
}
