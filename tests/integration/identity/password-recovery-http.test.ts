import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createTestApp } from "../../support/http/create-test-app.js";

import type { RequestPasswordRecoveryCommand } from "#modules/identity/application/commands/request-password-recovery.schema.js";

const validRequest: RequestPasswordRecoveryCommand = {
  email: "test@example.com",
};

describe("POST /identity/password-recovery", () => {
  it("returns 200 when the recovery request succeeds", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/password-recovery")
      .send(validRequest);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requested: true,
    });

    expect(mocks.identity.passwordRecovery.getHandler).toHaveBeenCalledOnce();

    expect(mocks.identity.passwordRecovery.execute).toHaveBeenCalledOnce();

    expect(mocks.identity.passwordRecovery.execute).toHaveBeenCalledWith(
      validRequest,
    );
  });

  it("rejects invalid email addresses", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/password-recovery")
      .send({
        email: "invalid-email",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(mocks.identity.passwordRecovery.getHandler).not.toHaveBeenCalled();

    expect(mocks.identity.passwordRecovery.execute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/password-recovery")
      .send({
        ...validRequest,
        userId: "synthetic-user-id",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(mocks.identity.passwordRecovery.execute).not.toHaveBeenCalled();
  });

  it("returns 500 when the recovery request fails unexpectedly", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.passwordRecovery.execute.mockRejectedValue(
      new Error("Synthetic database failure"),
    );

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
