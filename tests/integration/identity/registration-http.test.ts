
import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../../../src/delivery/http/app.js";

import { EmailAlreadyRegisteredError } from "../../../src/modules/identity/application/email-already-registered.error.js";
import { InvalidEmailVerificationTokenError } from "../../../src/modules/identity/application/invalid-email-verification-token.error.js";

import type { RegisterUserResult } from "../../../src/modules/identity/application/commands/register-user.handler.js";
import type { RegisterUserCommand } from "../../../src/modules/identity/application/commands/register-user.schema.js";
import type { VerifyEmailResult } from "../../../src/modules/identity/application/commands/verify-email.handler.js";
import type { VerifyEmailCommand } from "../../../src/modules/identity/application/commands/verify-email.schema.js";

const validRegistration = {
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "+15555550100",
  password: "synthetic-test-password",
  acceptTerms: true,
};

const userId = "00000000-0000-4000-8000-000000000001";

function createTestApp() {
  const execute = vi.fn(
    async (_command: RegisterUserCommand): Promise<RegisterUserResult> => ({
      userId,
    }),
  );

  const getRegisterUserHandler = vi.fn(async () => ({
    execute,
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
    getRegisterUserHandler,
    getVerifyEmailHandler,
    checkDatabaseReadiness,
  });

  return {
    app,
    execute,
    getRegisterUserHandler,
    getVerifyEmailHandler,
    checkDatabaseReadiness,
    verifyExecute,
  };
}

describe("POST /identity/register", () => {
  it("returns 201 when registration succeeds", async () => {
    const { app, execute } = createTestApp();

    const response = await request(app)
      .post("/identity/register")
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ userId });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(validRegistration);
  });

  it("returns 409 when the email is already registered", async () => {
    const { app, execute } = createTestApp();

    execute.mockRejectedValue(new EmailAlreadyRegisteredError());

    const response = await request(app)
      .post("/identity/register")
      .send(validRegistration);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "EMAIL_ALREADY_REGISTERED",
      message: "An account with this email already exists.",
    });
  });

  it("returns 400 when registration data is invalid", async () => {
    const { app, execute, getRegisterUserHandler } = createTestApp();

    const response = await request(app)
      .post("/identity/register")
      .send({
        ...validRegistration,
        email: "invalid-email",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["email"],
        }),
      ]),
    );

    expect(getRegisterUserHandler).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, execute } = createTestApp();

    const response = await request(app)
      .post("/identity/register")
      .send({
        ...validRegistration,
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 500 when registration fails unexpectedly", async () => {
    const { app, execute } = createTestApp();

    execute.mockRejectedValue(new Error("Synthetic database failure"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/identity/register")
        .send(validRegistration);

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

describe("POST /identity/verify-email", () => {
  const validToken = "a".repeat(43);

  it("returns 200 when email verification succeeds", async () => {
    const { app, verifyExecute } = createTestApp();

    const response = await request(app)
      .post("/identity/verify-email")
      .send({ token: validToken });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ verified: true });

    expect(verifyExecute).toHaveBeenCalledOnce();
    expect(verifyExecute).toHaveBeenCalledWith({
      token: validToken,
    });
  });

  it("returns a generic error when the verification token is invalid", async () => {
    const { app, verifyExecute } = createTestApp();

    verifyExecute.mockRejectedValue(
      new InvalidEmailVerificationTokenError(),
    );

    const response = await request(app)
      .post("/identity/verify-email")
      .send({ token: validToken });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "INVALID_EMAIL_VERIFICATION_TOKEN",
      message: "The verification token is invalid or has expired.",
    });
  });

  it("rejects malformed tokens without invoking the handler", async () => {
    const {
      app,
      verifyExecute,
      getVerifyEmailHandler,
    } = createTestApp();

    const response = await request(app)
      .post("/identity/verify-email")
      .send({ token: "not-a-valid-token" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(getVerifyEmailHandler).not.toHaveBeenCalled();
    expect(verifyExecute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, verifyExecute } = createTestApp();

    const response = await request(app)
      .post("/identity/verify-email")
      .send({
        token: validToken,
        userId,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(verifyExecute).not.toHaveBeenCalled();
  });

  it("returns 500 when verification fails unexpectedly", async () => {
    const { app, verifyExecute } = createTestApp();

    verifyExecute.mockRejectedValue(
      new Error("Synthetic database failure"),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/identity/verify-email")
        .send({ token: validToken });

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
