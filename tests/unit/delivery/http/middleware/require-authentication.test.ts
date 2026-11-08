import express, { type ErrorRequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createRequireAuthentication } from "#delivery/http/middleware/require-authentication.js";

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from "#modules/identity/application/ports/access-token-verifier.js";

import { InvalidAccessTokenError } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";

const authenticatedUser: VerifiedAccessToken = {
  userId: "00000000-0000-4000-8000-000000000001",
  issuedAt: new Date("2026-11-07T12:00:00.000Z"),
  expiresAt: new Date("2026-11-07T12:15:00.000Z"),
};

function createApp(verifier: AccessTokenVerifier) {
  const app = express();

  const middleware = createRequireAuthentication({
    getAccessTokenVerifier: vi.fn().mockResolvedValue(verifier),
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

  return app;
}

describe("require authentication middleware", () => {
  it("rejects requests without an authorization header", async () => {
    const verify = vi.fn();

    const app = createApp({ verify });

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization headers", async () => {
    const verify = vi.fn();

    const app = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Basic invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");
    expect(verify).not.toHaveBeenCalled();
  });

  it("accepts a valid Bearer token and exposes authenticated claims", async () => {
    const verify = vi.fn().mockResolvedValue(authenticatedUser);

    const app = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: authenticatedUser.userId,
      issuedAt: authenticatedUser.issuedAt.toISOString(),
      expiresAt: authenticatedUser.expiresAt.toISOString(),
    });

    expect(verify).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith("valid-access-token");
  });

  it("rejects invalid access tokens", async () => {
    const verify = vi.fn().mockRejectedValue(new InvalidAccessTokenError());

    const app = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-access-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });
  });

  it("forwards unexpected errors to Express error handling", async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new Error("Verifier infrastructure failure."));

    const app = createApp({ verify });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-access-token");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "INTERNAL_SERVER_ERROR",
    });
  });
});
