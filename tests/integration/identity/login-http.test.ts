import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "#delivery/http/app.js";
import { InvalidCredentialsError } from "#modules/identity/application/commands/login.handler.js";
import { InactiveUserError } from "#modules/identity/application/queries/get-active-user.handler.js";
import { InvalidAccessTokenError } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";

import type { LoginResult } from "#modules/identity/application/commands/login.handler.js";
import type { LoginCommand } from "#modules/identity/application/commands/login.schema.js";
import type { UserProfile } from "#modules/identity/application/ports/user-profile-repository.js";

const validLogin: LoginCommand = {
  email: "test@example.com",
  password: "synthetic-test-password",
};

const loginResult: LoginResult = {
  accessToken: "synthetic-access-token",
  tokenType: "Bearer",
  expiresAt: "2026-11-07T10:15:00.000Z",
};

const userProfile: UserProfile = {
  userId: "00000000-0000-4000-8000-000000000001",
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "+15555550100",
  status: "active",
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
};

const tokenVersion = 0;

function createTestApp() {
  const loginExecute = vi.fn(
    async (_command: LoginCommand): Promise<LoginResult> => loginResult,
  );

  const getLoginHandler = vi.fn(async () => ({
    execute: loginExecute,
  }));

  const getRegisterUserHandler = vi.fn(async () => ({
    execute: vi.fn(),
  }));

  const getVerifyEmailHandler = vi.fn(async () => ({
    execute: vi.fn(),
  }));

  const verifyToken = vi.fn(async (token: string) => {
    if (token !== "synthetic-valid-access-token") {
      throw new InvalidAccessTokenError();
    }

    return {
      userId: userProfile.userId,
      tokenVersion,
      issuedAt: new Date("2026-01-15T10:00:00.000Z"),
      expiresAt: new Date("2026-01-15T10:15:00.000Z"),
    };
  });

  const getAccessTokenVerifier = vi.fn(async () => ({
    verify: verifyToken,
  }));

  const activeUserExecute = vi.fn(
    async (_userId: string, _tokenVersion: number) => {},
  );

  const getActiveUserHandler = vi.fn(async () => ({
    execute: activeUserExecute,
  }));

  const profileExecute = vi.fn(async (userId: string): Promise<UserProfile> => {
    if (userId !== userProfile.userId) {
      throw new Error("Unexpected user ID.");
    }

    return userProfile;
  });

  const getUserProfileHandler = vi.fn(async () => ({
    execute: profileExecute,
  }));

  const getRequestPasswordRecoveryHandler = vi.fn(async () => ({
    execute: vi.fn(async () => ({
      requested: true as const,
    })),
  }));

  const getConfirmPasswordRecoveryHandler = vi.fn(async () => ({
    execute: vi.fn(async () => ({
      passwordReset: true as const,
    })),
  }));

  const checkDatabaseReadiness = vi.fn(async () => ({
    database: "test_database",
    username: "test_user",
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
  }));

  const app = createApp({
    identity: {
      getLoginHandler,
      getRegisterUserHandler,
      getVerifyEmailHandler,
      getAccessTokenVerifier,
      getUserProfileHandler,
      getActiveUserHandler,
      getRequestPasswordRecoveryHandler,
      getConfirmPasswordRecoveryHandler,
    },
    checkDatabaseReadiness,
  });

  return {
    app,
    loginExecute,
    getLoginHandler,
    verifyToken,
    activeUserExecute,
    getActiveUserHandler,
    profileExecute,
    getUserProfileHandler,
  };
}

describe("POST /identity/login", () => {
  it("returns an access token when authentication succeeds", async () => {
    const { app, loginExecute } = createTestApp();

    const response = await request(app)
      .post("/identity/login")
      .send(validLogin);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(loginResult);

    expect(loginExecute).toHaveBeenCalledOnce();
    expect(loginExecute).toHaveBeenCalledWith(validLogin);
  });

  it("returns 401 when credentials are invalid", async () => {
    const { app, loginExecute } = createTestApp();

    loginExecute.mockRejectedValue(new InvalidCredentialsError());

    const response = await request(app)
      .post("/identity/login")
      .send(validLogin);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect.",
    });
  });

  it("rejects invalid login data without invoking the handler", async () => {
    const { app, loginExecute, getLoginHandler } = createTestApp();

    const response = await request(app).post("/identity/login").send({
      email: "invalid-email",
      password: "synthetic-test-password",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(getLoginHandler).not.toHaveBeenCalled();
    expect(loginExecute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, loginExecute } = createTestApp();

    const response = await request(app)
      .post("/identity/login")
      .send({
        ...validLogin,
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(loginExecute).not.toHaveBeenCalled();
  });

  it("returns 500 when login fails unexpectedly", async () => {
    const { app, loginExecute } = createTestApp();

    loginExecute.mockRejectedValue(
      new Error("Synthetic authentication failure"),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/identity/login")
        .send(validLogin);

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

describe("GET /identity/me", () => {
  it("returns the authenticated user's profile", async () => {
    const {
      app,
      verifyToken,
      activeUserExecute,
      profileExecute,
      getUserProfileHandler,
    } = createTestApp();

    const response = await request(app)
      .get("/identity/me")
      .set("Authorization", "Bearer synthetic-valid-access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        ...userProfile,
        createdAt: userProfile.createdAt.toISOString(),
      },
    });

    expect(verifyToken).toHaveBeenCalledOnce();
    expect(verifyToken).toHaveBeenCalledWith("synthetic-valid-access-token");

    expect(activeUserExecute).toHaveBeenCalledOnce();
    expect(activeUserExecute).toHaveBeenCalledWith(
      userProfile.userId,
      tokenVersion,
    );

    expect(getUserProfileHandler).toHaveBeenCalledOnce();
    expect(profileExecute).toHaveBeenCalledWith(userProfile.userId);
  });

  it("returns 401 when the authorization header is missing", async () => {
    const { app, verifyToken, getUserProfileHandler } = createTestApp();

    const response = await request(app).get("/identity/me");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");
    expect(verifyToken).not.toHaveBeenCalled();
    expect(getUserProfileHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token is invalid", async () => {
    const { app, verifyToken, getUserProfileHandler } = createTestApp();

    const response = await request(app)
      .get("/identity/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");
    expect(verifyToken).toHaveBeenCalledOnce();
    expect(getUserProfileHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when the authenticated user is inactive", async () => {
    const { app, activeUserExecute, getUserProfileHandler } = createTestApp();

    activeUserExecute.mockRejectedValue(new InactiveUserError());

    const response = await request(app)
      .get("/identity/me")
      .set("Authorization", "Bearer synthetic-valid-access-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");
    expect(getUserProfileHandler).not.toHaveBeenCalled();
  });
});
