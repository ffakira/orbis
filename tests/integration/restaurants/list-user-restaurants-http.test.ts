import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  createTestApp,
  TEST_ACCESS_TOKEN,
  TEST_TOKEN_VERSION,
  TEST_USER_ID,
} from "../../support/http/create-test-app.js";

describe("GET /restaurants", () => {
  it("returns restaurants associated with the authenticated user", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    mocks.restaurants.list.execute.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Test Restaurant",
        role: "owner",
        membershipStatus: "active",
        joinedAt: new Date("2026-01-15T10:00:00.000Z"),
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        name: "Another Restaurant",
        role: "staff",
        membershipStatus: "suspended",
        joinedAt: new Date("2026-02-10T12:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/restaurants")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      restaurants: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          name: "Test Restaurant",
          role: "owner",
          membershipStatus: "active",
          joinedAt: "2026-01-15T10:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          name: "Another Restaurant",
          role: "staff",
          membershipStatus: "suspended",
          joinedAt: "2026-02-10T12:00:00.000Z",
        },
      ],
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

    expect(mocks.restaurants.list.getHandler).toHaveBeenCalledOnce();
    expect(mocks.restaurants.list.execute).toHaveBeenCalledOnce();
    expect(mocks.restaurants.list.execute).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns an empty array when the user has no restaurant memberships", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .get("/restaurants")
      .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      restaurants: [],
    });

    expect(mocks.restaurants.list.execute).toHaveBeenCalledOnce();
    expect(mocks.restaurants.list.execute).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns 401 when the authorization header is missing", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app).get("/restaurants");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(mocks.identity.accessTokenVerifier.verify).not.toHaveBeenCalled();
    expect(mocks.restaurants.list.execute).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token is invalid", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    const response = await request(app)
      .get("/restaurants")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHENTICATED");

    expect(mocks.identity.accessTokenVerifier.verify).toHaveBeenCalledOnce();
    expect(mocks.restaurants.list.execute).not.toHaveBeenCalled();
  });

  it("returns 500 when retrieving restaurants fails unexpectedly", async () => {
    const { app, mocks } = createTestApp({ restaurants: true });

    mocks.restaurants.list.execute.mockRejectedValue(
      new Error("Synthetic restaurant retrieval failure"),
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .get("/restaurants")
        .set("Authorization", `Bearer ${TEST_ACCESS_TOKEN}`);

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
