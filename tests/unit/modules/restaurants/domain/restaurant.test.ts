import { describe, expect, it } from "vitest";

import { Restaurant } from "#modules/restaurants/domain/restaurant.js";

describe("Restaurant", () => {
  const createdAt = "2026-11-08T12:00:00.000Z";

  const validLocation = {
    street: "Rua das Flores",
    number: "120",
    complement: null,
    neighbourhood: "Centro",
    city: "Tubarão",
    state: "SC",
    postalCode: "88701230",
    countryCode: "BR" as const,
    latitude: -28.4713,
    longitude: -49.0144,
  };

  it("creates a restaurant with a normalized name and no location", () => {
    const restaurant = Restaurant.create({
      id: "restaurant-id",
      name: "  Example Restaurant  ",
      createdAt,
      updatedAt: createdAt,
    });

    expect(restaurant).toEqual({
      id: "restaurant-id",
      name: "Example Restaurant",
      location: null,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it("creates a restaurant with a location", () => {
    const restaurant = Restaurant.create({
      id: "restaurant-id",
      name: "Example Restaurant",
      location: validLocation,
      createdAt,
      updatedAt: createdAt,
    });

    expect(restaurant.location).toEqual(validLocation);
  });

  it("rejects an invalid location", () => {
    expect(() =>
      Restaurant.create({
        id: "restaurant-id",
        name: "Example Restaurant",
        location: {
          ...validLocation,
          latitude: 91,
        },
        createdAt,
        updatedAt: createdAt,
      }),
    ).toThrow();
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
