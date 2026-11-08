import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "#delivery/http/app.js";

import { InvalidCredentialsError } from "#modules/identity/application/commands/login.handler.js";

import type { LoginCommand } from "#modules/identity/application/commands/login.schema.js";
import type { LoginResult } from "#modules/identity/application/commands/login.handler.js";
import type { RegisterUserResult } from "#modules/identity/application/commands/register-user.handler.js";
import type { RegisterUserCommand } from "#modules/identity/application/commands/register-user.schema.js";
import type { VerifyEmailResult } from "#modules/identity/application/commands/verify-email.handler.js";
import type { VerifyEmailCommand } from "#modules/identity/application/commands/verify-email.schema.js";

const validLogin: LoginCommand = {
  email: "test@example.com",
  password: "synthetic-test-password",
};

const loginResult: LoginResult = {
  accessToken: "synthetic-access-token",
  tokenType: "Bearer",
  expiresAt: "2026-11-07T10:15:00.000Z",
};

function createTestApp() {
  const loginExecute = vi.fn(
    async (_command: LoginCommand): Promise<LoginResult> => loginResult,
  );

  const getLoginHandler = vi.fn(async () => ({
    execute: loginExecute,
  }));

  const registerExecute = vi.fn(
    async (_command: RegisterUserCommand): Promise<RegisterUserResult> => ({
      userId: "00000000-0000-4000-8000-000000000001",
    }),
  );

  const getRegisterUserHandler = vi.fn(async () => ({
    execute: registerExecute,
  }));

  const verifyExecute = vi.fn(
    async (_command: VerifyEmailCommand): Promise<VerifyEmailResult> => ({
      verified: true,
    }),
  );

  const getVerifyEmailHandler = vi.fn(async () => ({
    execute: verifyExecute,
  }));

  const checkDatabaseReadiness = vi.fn(async () => ({
    database: "test_database",
    username: "test_user",
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
  }));

  const app = createApp({
    getLoginHandler,
    getRegisterUserHandler,
    getVerifyEmailHandler,
    checkDatabaseReadiness,
  });

  return {
    app,
    loginExecute,
    getLoginHandler,
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
