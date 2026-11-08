import { describe, expect, it } from "vitest";

import { RestaurantMembership } from "#modules/restaurants/domain/restaurant-membership.js";

describe("RestaurantMembership", () => {
  const createdAt = "2026-11-08T12:00:00.000Z";

  it("creates an owner membership", () => {
    const membership = RestaurantMembership.create({
      id: "membership-id",
      restaurantId: "restaurant-id",
      userId: "user-id",
      role: "owner",
      createdAt,
    });

    expect(membership).toEqual({
      id: "membership-id",
      restaurantId: "restaurant-id",
      userId: "user-id",
      role: "owner",
      createdAt,
    });
  });

  it.each(["owner", "manager", "staff"] as const)(
    "accepts the %s role",
    (role) => {
      const membership = RestaurantMembership.create({
        id: "membership-id",
        restaurantId: "restaurant-id",
        userId: "user-id",
        role,
        createdAt,
      });

      expect(membership.role).toBe(role);
    },
  );

  it("rejects an unsupported role", () => {
    expect(() =>
      RestaurantMembership.create({
        id: "membership-id",
        restaurantId: "restaurant-id",
        userId: "user-id",
        role: "administrator" as "owner",
        createdAt,
      }),
    ).toThrow();
  });
});
