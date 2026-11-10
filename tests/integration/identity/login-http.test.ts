import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { InvalidCredentialsError } from "#modules/identity/application/commands/login.handler.js";
import { InactiveUserError } from "#modules/identity/application/queries/get-active-user.handler.js";

import {
  createTestApp,
  TEST_ACCESS_TOKEN,
  TEST_LOGIN_RESULT,
  TEST_USER_PROFILE,
  TEST_TOKEN_VERSION,
} from "../../support/http/create-test-app.js";

import type { LoginCommand } from "#modules/identity/application/commands/login.schema.js";

const validLogin: LoginCommand = {
  email: "test@example.com",
  password: "synthetic-test-password",
};

describe("POST /identity/login", () => {
  it("returns an access token when authentication succeeds", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/login")
      .send(validLogin);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(TEST_LOGIN_RESULT);

    expect(mocks.identity.login.execute).toHaveBeenCalledOnce();
    expect(mocks.identity.login.execute).toHaveBeenCalledWith(validLogin);
  });

  it("returns 401 when credentials are invalid", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.login.execute.mockRejectedValue(
      new InvalidCredentialsError(),
    );

    const response = await request(app)
      .post("/identity/login")
      .send(validLogin);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("rejects invalid login data without invoking the handler", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app).post("/identity/login").send({
      email: "invalid-email",
      password: validLogin.password,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(mocks.identity.login.getHandler).not.toHaveBeenCalled();
    expect(mocks.identity.login.execute).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .post("/identity/login")
      .send({
        ...validLogin,
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
    expect(mocks.identity.login.execute).not.toHaveBeenCalled();
  });

  it("returns 500 when login fails unexpectedly", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.login.execute.mockRejectedValue(
      new Error("Synthetic authentication failure"),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/identity/login")
        .send(validLogin);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("INTERNAL_SERVER_ERROR");
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("GET /identity/me", () => {
  it("returns the authenticated user's profile", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .get("/identity/me")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        ...TEST_USER_PROFILE,
        createdAt: TEST_USER_PROFILE.createdAt.toISOString(),
      },
    });

    expect(mocks.identity.accessTokenVerifier.verify).toHaveBeenCalledWith(
      TEST_ACCESS_TOKEN,
    );

    expect(mocks.identity.activeUser.execute).toHaveBeenCalledWith(
      TEST_USER_PROFILE.userId,
      TEST_TOKEN_VERSION,
    );

    expect(mocks.identity.userProfile.execute).toHaveBeenCalledWith(
      TEST_USER_PROFILE.userId,
    );
  });

  it("returns 401 when the authorization header is missing", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app).get("/identity/me");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(mocks.identity.accessTokenVerifier.verify).not.toHaveBeenCalled();
    expect(mocks.identity.userProfile.getHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token is invalid", async () => {
    const { app, mocks } = createTestApp();

    const response = await request(app)
      .get("/identity/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(mocks.identity.accessTokenVerifier.verify).toHaveBeenCalledOnce();
    expect(mocks.identity.userProfile.getHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when the authenticated user is inactive", async () => {
    const { app, mocks } = createTestApp();

    mocks.identity.activeUser.execute.mockRejectedValue(
      new InactiveUserError(),
    );

    const response = await request(app)
      .get("/identity/me")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");
    expect(mocks.identity.userProfile.getHandler).not.toHaveBeenCalled();
  });
});
