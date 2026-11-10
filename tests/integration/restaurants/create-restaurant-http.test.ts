import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { InvalidAccessTokenError } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";
import { createApp } from "#presentation/http/app.js";

import type { CreateRestaurantResult } from "#modules/restaurants/application/commands/create-restaurant.handler.js";
import type { CreateRestaurantCommand } from "#modules/restaurants/application/commands/create-restaurant.schema.js";

const authenticatedUserId = "00000000-0000-4000-8000-000000000001";
const restaurantId = "00000000-0000-4000-8000-000000000002";
const tokenVersion = 0;
const validAccessToken = "synthetic-valid-access-token";

const verifiedToken = {
  userId: authenticatedUserId,
  tokenVersion,
  issuedAt: new Date("2026-01-15T10:00:00.000Z"),
  expiresAt: new Date("2026-01-15T10:15:00.000Z"),
};

function createTestApp() {
  const execute = vi.fn(
    async (
      _command: CreateRestaurantCommand,
    ): Promise<CreateRestaurantResult> => ({
      restaurantId,
    }),
  );

  const getCreateRestaurantHandler = vi.fn(async () => ({
    execute,
  }));

  const verifyToken = vi.fn(async (token: string) => {
    if (token !== validAccessToken) {
      throw new InvalidAccessTokenError();
    }

    return verifiedToken;
  });

  const getAccessTokenVerifier = vi.fn(async () => ({
    verify: verifyToken,
  }));

  const activeUserExecute = vi.fn(
    async (_userId: string, _version: number): Promise<void> => {},
  );

  const getActiveUserHandler = vi.fn(async () => ({
    execute: activeUserExecute,
  }));

  const checkDatabaseReadiness = vi.fn(async () => ({
    database: "test_database",
    username: "test_user",
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
  }));

  const app = createApp({
    identity: {
      getLoginHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
      getRegisterUserHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
      getVerifyEmailHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
      getAccessTokenVerifier,
      getUserProfileHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
      getActiveUserHandler,
      getRequestPasswordRecoveryHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
      getConfirmPasswordRecoveryHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
    },
    restaurants: {
      getCreateRestaurantHandler,
      getAccessTokenVerifier,
      getActiveUserHandler,
    },
    checkDatabaseReadiness,
  });

  return {
    app,
    execute,
    getCreateRestaurantHandler,
    verifyToken,
    activeUserExecute,
  };
}

describe("POST /restaurants", () => {
  it("creates a restaurant for the authenticated user", async () => {
    const {
      app,
      execute,
      getCreateRestaurantHandler,
      verifyToken,
      activeUserExecute,
    } = createTestApp();

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ name: "  Test Restaurant  " });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ restaurantId });

    expect(verifyToken).toHaveBeenCalledOnce();
    expect(verifyToken).toHaveBeenCalledWith(validAccessToken);

    expect(activeUserExecute).toHaveBeenCalledOnce();
    expect(activeUserExecute).toHaveBeenCalledWith(
      authenticatedUserId,
      tokenVersion,
    );

    expect(getCreateRestaurantHandler).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({
      userId: authenticatedUserId,
      name: "Test Restaurant",
    });
  });

  it("returns 401 when the authorization header is missing", async () => {
    const { app, execute, verifyToken } = createTestApp();

    const response = await request(app)
      .post("/restaurants")
      .send({ name: "Test Restaurant" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(verifyToken).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token is invalid", async () => {
    const { app, execute, verifyToken } = createTestApp();

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", "Bearer invalid-token")
      .send({ name: "Test Restaurant" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(verifyToken).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 400 when the restaurant data is invalid", async () => {
    const { app, execute, getCreateRestaurantHandler } = createTestApp();

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(getCreateRestaurantHandler).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects userId supplied in the request body", async () => {
    const { app, execute, getCreateRestaurantHandler } = createTestApp();

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({
        name: "Test Restaurant",
        userId: "00000000-0000-4000-8000-000000000099",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(getCreateRestaurantHandler).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 500 when restaurant creation fails unexpectedly", async () => {
    const { app, execute } = createTestApp();

    execute.mockRejectedValue(
      new Error("Synthetic restaurant persistence failure"),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/restaurants")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "Test Restaurant" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      });
    } finally {
      errorSpy.mockRestore();
    }
  });
});
