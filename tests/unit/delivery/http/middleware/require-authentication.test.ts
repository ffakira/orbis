import express, { type ErrorRequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createRequireAuthentication } from "#delivery/http/middleware/require-authentication.js";
import {
  InactiveUserError,
  InvalidTokenVersionError,
} from "#modules/identity/application/queries/get-active-user.handler.js";
import { InvalidAccessTokenError } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from "#modules/identity/application/ports/access-token-verifier.js";

const authenticatedUser: VerifiedAccessToken = {
  userId: "00000000-0000-4000-8000-000000000001",
  tokenVersion: 0,
  issuedAt: new Date("2026-11-07T12:00:00.000Z"),
  expiresAt: new Date("2026-11-07T12:15:00.000Z"),
};

function createApp(
  verifier: AccessTokenVerifier,
  executeActiveUser = vi.fn(
    async (_userId: string, _tokenVersion: number): Promise<void> => {},
  ),
) {
  const app = express();

  const getActiveUserHandler = vi.fn(async () => ({
    execute: executeActiveUser,
  }));

  const middleware = createRequireAuthentication({
    getAccessTokenVerifier: vi.fn().mockResolvedValue(verifier),
    getActiveUserHandler,
  });

  app.get("/protected", middleware, (_req, res) => {
    return res.status(200).json(res.locals.auth);
  });

  const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
    });
  };

  app.use(errorHandler);

  return {
    app,
    executeActiveUser,
    getActiveUserHandler,
  };
}

describe("require authentication middleware", () => {
  it("rejects requests without an authorization header", async () => {
    const verify = vi.fn();
    const { app, executeActiveUser } = createApp({ verify });

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });

    expect(verify).not.toHaveBeenCalled();
    expect(executeActiveUser).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization headers", async () => {
    const verify = vi.fn();
    const { app, executeActiveUser } = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Basic invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(verify).not.toHaveBeenCalled();
    expect(executeActiveUser).not.toHaveBeenCalled();
  });

  it("accepts a valid Bearer token and exposes authenticated claims", async () => {
    const verify = vi.fn().mockResolvedValue(authenticatedUser);

    const { app, executeActiveUser, getActiveUserHandler } = createApp({
      verify,
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: authenticatedUser.userId,
      tokenVersion: authenticatedUser.tokenVersion,
      issuedAt: authenticatedUser.issuedAt.toISOString(),
      expiresAt: authenticatedUser.expiresAt.toISOString(),
    });

    expect(verify).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith("valid-access-token");

    expect(getActiveUserHandler).toHaveBeenCalledOnce();
    expect(executeActiveUser).toHaveBeenCalledOnce();
    expect(executeActiveUser).toHaveBeenCalledWith(
      authenticatedUser.userId,
      authenticatedUser.tokenVersion,
    );
  });

  it("rejects inactive users", async () => {
    const verify = vi.fn().mockResolvedValue(authenticatedUser);

    const executeActiveUser = vi
      .fn()
      .mockRejectedValue(new InactiveUserError());

    const { app } = createApp({ verify }, executeActiveUser);

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });

    expect(verify).toHaveBeenCalledOnce();
    expect(executeActiveUser).toHaveBeenCalledWith(
      authenticatedUser.userId,
      authenticatedUser.tokenVersion,
    );
  });

  it("rejects tokens with an invalidated token version", async () => {
    const verify = vi.fn().mockResolvedValue(authenticatedUser);

    const executeActiveUser = vi
      .fn()
      .mockRejectedValue(new InvalidTokenVersionError());

    const { app } = createApp({ verify }, executeActiveUser);

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });

    expect(executeActiveUser).toHaveBeenCalledWith(
      authenticatedUser.userId,
      authenticatedUser.tokenVersion,
    );
  });

  it("rejects invalid access tokens", async () => {
    const verify = vi.fn().mockRejectedValue(new InvalidAccessTokenError());

    const { app, executeActiveUser } = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-access-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });

    expect(executeActiveUser).not.toHaveBeenCalled();
  });

  it("forwards unexpected verifier errors to Express error handling", async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new Error("Verifier infrastructure failure."));

    const { app, executeActiveUser } = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "INTERNAL_SERVER_ERROR",
    });

    expect(executeActiveUser).not.toHaveBeenCalled();
  });

  it("forwards unexpected active-user errors to Express error handling", async () => {
    const verify = vi.fn().mockResolvedValue(authenticatedUser);

    const executeActiveUser = vi
      .fn()
      .mockRejectedValue(new Error("Database connection failure."));

    const { app } = createApp({ verify }, executeActiveUser);

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "INTERNAL_SERVER_ERROR",
    });

    expect(executeActiveUser).toHaveBeenCalledWith(
      authenticatedUser.userId,
      authenticatedUser.tokenVersion,
    );
  });
});
