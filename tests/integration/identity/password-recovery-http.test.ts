import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "#delivery/http/app.js";

import type { RequestPasswordRecoveryCommand } from "#modules/identity/application/commands/request-password-recovery.schema.js";

const validRequest: RequestPasswordRecoveryCommand = {
  email: "test@example.com",
};

function createTestApp() {
  const execute = vi.fn(async (_command: RequestPasswordRecoveryCommand) => ({
    requested: true as const,
  }));

  const getRequestPasswordRecoveryHandler = vi.fn(async () => ({
    execute,
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
      getRequestPasswordRecoveryHandler,
      getAccessTokenVerifier: vi.fn(async () => ({
        verify: vi.fn(),
      })),
      getUserProfileHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
      getActiveUserHandler: vi.fn(async () => ({
        execute: vi.fn(),
      })),
    },
    checkDatabaseReadiness,
  });

  return {
    app,
    execute,
    getRequestPasswordRecoveryHandler,
  };
}

describe("POST /identity/password-recovery", () => {
  it("returns 200 when the recovery request succeeds", async () => {
    const { app, execute, getRequestPasswordRecoveryHandler } = createTestApp();

    const response = await request(app)
      .post("/identity/password-recovery")
      .send(validRequest);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requested: true,
    });

    expect(getRequestPasswordRecoveryHandler).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(validRequest);
  });

  it("rejects invalid email addresses", async () => {
    const { app, execute, getRequestPasswordRecoveryHandler } = createTestApp();

    const response = await request(app)
      .post("/identity/password-recovery")
      .send({
        email: "invalid-email",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(getRequestPasswordRecoveryHandler).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, execute } = createTestApp();

    const response = await request(app)
      .post("/identity/password-recovery")
      .send({
        ...validRequest,
        userId: "synthetic-user-id",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 500 when the recovery request fails unexpectedly", async () => {
    const { app, execute } = createTestApp();

    execute.mockRejectedValue(new Error("Synthetic database failure"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/identity/password-recovery")
        .send(validRequest);

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
