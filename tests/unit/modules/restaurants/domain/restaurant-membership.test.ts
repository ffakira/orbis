import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { RestaurantMembership } from "#modules/restaurants/domain/restaurant-membership.js";

describe("RestaurantMembership", () => {
  const createdAt = "2026-11-08T12:00:00.000Z";

  function createMembership(
    overrides: Partial<Parameters<typeof RestaurantMembership.create>[0]> = {},
  ) {
    return RestaurantMembership.create({
      id: "membership-id",
      restaurantId: "restaurant-id",
      userId: "user-id",
      role: "staff",
      status: "active",
      createdAt,
      updatedAt: createdAt,
      ...overrides,
    });
  }

  it("creates an active membership", () => {
    const membership = createMembership();

    expect(membership).toEqual({
      id: "membership-id",
      restaurantId: "restaurant-id",
      userId: "user-id",
      role: "staff",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    });
  });

  it.each(["owner", "manager", "staff"] as const)(
    "supports the %s role",
    (role) => {
      const membership = createMembership({ role });

      expect(membership.role).toBe(role);
    },
  );

  it.each(["active", "suspended"] as const)(
    "supports the %s status",
    (status) => {
      const membership = createMembership({ status });

      expect(membership.status).toBe(status);
    },
  );

  it("allows the same user to have memberships in different restaurants", () => {
    const first = createMembership({
      restaurantId: "restaurant-one",
      role: "owner",
    });

    const second = createMembership({
      restaurantId: "restaurant-two",
      role: "staff",
    });

    expect(first.userId).toBe(second.userId);
    expect(first.restaurantId).not.toBe(second.restaurantId);
    expect(first.role).not.toBe(second.role);
  });

  it("rejects an empty restaurant ID", () => {
    expect(() => createMembership({ restaurantId: "" })).toThrow(ZodError);
  });

  it("rejects an empty user ID", () => {
    expect(() => createMembership({ userId: "" })).toThrow(ZodError);
  });

  it("rejects an unsupported role", () => {
    expect(() =>
      createMembership({
        role: "administrator" as "staff",
      }),
    ).toThrow(ZodError);
  });

  it("rejects an unsupported status", () => {
    expect(() =>
      createMembership({
        status: "deleted" as "active",
      }),
    ).toThrow(ZodError);
  });

  it("rejects an invalid creation timestamp", () => {
    expect(() => createMembership({ createdAt: "invalid-date" })).toThrow(
      ZodError,
    );
  });
});
