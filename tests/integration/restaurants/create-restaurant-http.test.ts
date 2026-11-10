import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  createTestApp,
  TEST_ACCESS_TOKEN,
  TEST_RESTAURANT_ID,
  TEST_TOKEN_VERSION,
  TEST_USER_ID,
} from "../../support/http/create-test-app.js";

describe("POST /restaurants", () => {
  it("creates a restaurant for the authenticated user", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`)
      .send({ name: "  Test Restaurant  " });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      restaurantId: TEST_RESTAURANT_ID,
    });

    expect(mocks.identity.accessTokenVerifier.verify).toHaveBeenCalledOnce();
    expect(mocks.identity.accessTokenVerifier.verify).toHaveBeenCalledWith(
      TEST_ACCESS_TOKEN,
    );

    expect(mocks.identity.activeUser.execute).toHaveBeenCalledOnce();
    expect(mocks.identity.activeUser.execute).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_TOKEN_VERSION,
    );

    expect(mocks.restaurants.create.getHandler).toHaveBeenCalledOnce();
    expect(mocks.restaurants.create.execute).toHaveBeenCalledOnce();
    expect(mocks.restaurants.create.execute).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      name: "Test Restaurant",
    });
  });

  it("returns 401 when the authorization header is missing", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .post("/restaurants")
      .send({ name: "Test Restaurant" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(mocks.identity.accessTokenVerifier.verify).not.toHaveBeenCalled();

    expect(mocks.restaurants.create.execute).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token is invalid", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", "Bearer invalid-token")
      .send({ name: "Test Restaurant" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(mocks.identity.accessTokenVerifier.verify).toHaveBeenCalledOnce();
    expect(mocks.restaurants.create.execute).not.toHaveBeenCalled();
  });

  it("returns 400 when the restaurant data is invalid", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(mocks.restaurants.create.getHandler).not.toHaveBeenCalled();
    expect(mocks.restaurants.create.execute).not.toHaveBeenCalled();
  });

  it("rejects userId supplied in the request body", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .post("/restaurants")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`)
      .send({
        name: "Test Restaurant",
        userId: "00000000-0000-4000-8000-000000000099",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");

    expect(mocks.restaurants.create.getHandler).not.toHaveBeenCalled();
    expect(mocks.restaurants.create.execute).not.toHaveBeenCalled();
  });

  it("returns 500 when restaurant creation fails unexpectedly", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    mocks.restaurants.create.execute.mockRejectedValue(
      new Error("Synthetic restaurant persistence failure"),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/restaurants")
        .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`)
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
