import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { EmailAlreadyRegisteredError } from "#modules/identity/application/errors/email-already-registered.error.js";
import { InvalidEmailVerificationTokenError } from "#modules/identity/application/errors/invalid-email-verification-token.error.js";

import {
  createTestApp,
  TEST_USER_ID,
} from "../../support/http/create-test-app.js";

const validRegistration = {
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "+15555550100",
  password: "synthetic-test-password",
  acceptTerms: true,
};

describe("POST /identity/register", () => {
  it("returns 201 when registration succeeds", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/register")
      .send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ userId: TEST_USER_ID });

    expect(mocks.identity.registration.execute).toHaveBeenCalledOnce();
    expect(mocks.identity.registration.execute).toHaveBeenCalledWith(
      validRegistration,
    );
  });

  it("returns 409 when the email is already registered", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.registration.execute.mockRejectedValue(
      new EmailAlreadyRegisteredError(),
    );

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
    const { app, mocks } = createTestApp();

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

    expect(mocks.identity.registration.getHandler).not.toHaveBeenCalled();
    expect(mocks.identity.registration.execute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/register")
      .send({
        ...validRegistration,
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(mocks.identity.registration.execute).not.toHaveBeenCalled();
  });

  it("returns 500 when registration fails unexpectedly", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.registration.execute.mockRejectedValue(
      new Error("Synthetic database failure"),
    );

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
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/verify-email")
      .send({ token: validToken });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ verified: true });

    expect(mocks.identity.emailVerification.execute).toHaveBeenCalledOnce();
    expect(mocks.identity.emailVerification.execute).toHaveBeenCalledWith({
      token: validToken,
    });
  });

  it("returns a generic error when the verification token is invalid", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.emailVerification.execute.mockRejectedValue(
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
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/verify-email")
      .send({ token: "not-a-valid-token" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(mocks.identity.emailVerification.getHandler).not.toHaveBeenCalled();
    expect(mocks.identity.emailVerification.execute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app).post("/identity/verify-email").send({
      token: validToken,
      userId: TEST_USER_ID,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(mocks.identity.emailVerification.execute).not.toHaveBeenCalled();
  });

  it("returns 500 when verification fails unexpectedly", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.emailVerification.execute.mockRejectedValue(
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
