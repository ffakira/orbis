import { describe, expect, it } from "vitest";

import { Restaurant } from "#modules/restaurants/domain/restaurant.js";

describe("Restaurant", () => {
  const createdAt = "2026-11-08T12:00:00.000Z";

  it("creates a restaurant with a normalized name", () => {
    const restaurant = Restaurant.create({
      id: "restaurant-id",
      name: "  Example Restaurant  ",
      createdAt,
      updatedAt: createdAt,
    });

    expect(restaurant).toEqual({
      id: "restaurant-id",
      name: "Example Restaurant",
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("rejects an empty name", () => {
    expect(() =>
      Restaurant.create({
        id: "restaurant-id",
        name: "   ",
        createdAt,
        updatedAt: createdAt,
      }),
    ).toThrow();
  });

  it("rejects a name longer than 120 characters", () => {
    expect(() =>
      Restaurant.create({
        id: "restaurant-id",
        name: "R".repeat(121),
        createdAt,
        updatedAt: createdAt,
      }),
    ).toThrow();
  });

  it("rejects an invalid creation timestamp", () => {
    expect(() =>
      Restaurant.create({
        id: "restaurant-id",
        name: "Example Restaurant",
        createdAt: "invalid-date",
        updatedAt: createdAt,
      }),
    ).toThrow();
  });
});
