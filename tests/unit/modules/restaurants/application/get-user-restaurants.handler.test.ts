import { describe, expect, it, vi } from "vitest";

import { GetUserRestaurantsHandler } from "#modules/restaurants/application/queries/get-user-restaurants.handler.js";

import type {
  UserRestaurant,
  UserRestaurantsRepository,
} from "#modules/restaurants/application/ports/user-restaurants-repository.js";

describe("GetUserRestaurantsHandler", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";

  const restaurants: UserRestaurant[] = [
    {
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Active Restaurant",
      role: "owner",
      membershipStatus: "active",
      joinedAt: new Date("2026-01-15T10:00:00.000Z"),
    },
    {
      id: "770e8400-e29b-41d4-a716-446655440000",
      name: "Suspended Restaurant",
      role: "staff",
      membershipStatus: "suspended",
      joinedAt: new Date("2026-02-10T12:00:00.000Z"),
    },
  ];

  function createHandler() {
    const userRestaurants: UserRestaurantsRepository = {
      findByUserId: vi.fn(),
    };

    return {
      handler: new GetUserRestaurantsHandler({ userRestaurants }),
      userRestaurants,
    };
  }

  it("returns restaurants associated with the user", async () => {
    const { handler, userRestaurants } = createHandler();

    vi.mocked(userRestaurants.findByUserId).mockResolvedValue(restaurants);

    await expect(handler.execute(userId)).resolves.toEqual(restaurants);

    expect(userRestaurants.findByUserId).toHaveBeenCalledOnce();
    expect(userRestaurants.findByUserId).toHaveBeenCalledWith(userId);
  });

  it("returns an empty array when the user has no restaurant memberships", async () => {
    const { handler, userRestaurants } = createHandler();

    vi.mocked(userRestaurants.findByUserId).mockResolvedValue([]);

    await expect(handler.execute(userId)).resolves.toEqual([]);

    expect(userRestaurants.findByUserId).toHaveBeenCalledWith(userId);
  });

  it("propagates repository errors", async () => {
    const { handler, userRestaurants } = createHandler();
    const error = new Error("Database unavailable.");

    vi.mocked(userRestaurants.findByUserId).mockRejectedValue(error);

    await expect(handler.execute(userId)).rejects.toBe(error);
  });
});
