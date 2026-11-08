import { describe, expect, it, vi } from "vitest";

import { CreateRestaurantHandler } from "#modules/restaurants/application/commands/create-restaurant.handler.js";

import type { RestaurantsTransaction } from "#modules/restaurants/application/ports/unit-of-work.js";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const createdAt = "2026-11-08T12:00:00.000Z";

describe("CreateRestaurantHandler", () => {
  it("creates a restaurant and its initial owner membership transactionally", async () => {
    const insertedRestaurants: unknown[] = [];
    const insertedMemberships: unknown[] = [];

    const transaction: RestaurantsTransaction = {
      restaurants: {
        insert: vi.fn(async (restaurant) => {
          insertedRestaurants.push(restaurant);
        }),
      },
      memberships: {
        insert: vi.fn(async (membership) => {
          insertedMemberships.push(membership);
        }),
      },
    };

    const transactionSpy = vi.fn();

    const unitOfWork = {
      async transaction<T>(
        operation: (tx: RestaurantsTransaction) => Promise<T>,
      ): Promise<T> {
        transactionSpy();
        return operation(transaction);
      },
    };

    const ids = [
      "660e8400-e29b-41d4-a716-446655440000",
      "770e8400-e29b-41d4-a716-446655440000",
    ];

    let idIndex = 0;

    const handler = new CreateRestaurantHandler({
      ids: {
        generate: () => ids[idIndex++]!,
      },
      clock: {
        now: () => new Date(createdAt),
      },
      unitOfWork,
    });

    const result = await handler.execute({
      userId,
      name: "  Test Restaurant  ",
    });

    expect(result).toEqual({
      restaurantId: ids[0],
    });

    expect(transactionSpy).toHaveBeenCalledOnce();
    expect(insertedRestaurants).toHaveLength(1);
    expect(insertedMemberships).toHaveLength(1);

    expect(insertedRestaurants[0]).toMatchObject({
      id: ids[0],
      name: "Test Restaurant",
      createdAt,
      updatedAt: createdAt,
    });

    expect(insertedMemberships[0]).toMatchObject({
      id: ids[1],
      restaurantId: ids[0],
      userId,
      role: "owner",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    });

    expect(transaction.restaurants.insert).toHaveBeenCalledOnce();
    expect(transaction.memberships.insert).toHaveBeenCalledOnce();
  });

  it("propagates membership insertion failures", async () => {
    const transaction: RestaurantsTransaction = {
      restaurants: {
        insert: vi.fn(async () => {}),
      },
      memberships: {
        insert: vi.fn(async () => {
          throw new Error("Membership insertion failed.");
        }),
      },
    };

    const handler = new CreateRestaurantHandler({
      ids: {
        generate: vi
          .fn()
          .mockReturnValueOnce("660e8400-e29b-41d4-a716-446655440000")
          .mockReturnValueOnce("770e8400-e29b-41d4-a716-446655440000"),
      },
      clock: {
        now: () => new Date(createdAt),
      },
      unitOfWork: {
        transaction: (operation) => operation(transaction),
      },
    });

    await expect(
      handler.execute({
        userId,
        name: "Test Restaurant",
      }),
    ).rejects.toThrow("Membership insertion failed.");

    expect(transaction.restaurants.insert).toHaveBeenCalledOnce();
    expect(transaction.memberships.insert).toHaveBeenCalledOnce();
  });

  it("rejects an invalid command before opening a transaction", async () => {
    const transactionSpy = vi.fn();

    const handler = new CreateRestaurantHandler({
      ids: {
        generate: vi.fn(),
      },
      clock: {
        now: () => new Date(createdAt),
      },
      unitOfWork: {
        async transaction<T>(
          _operation: (transaction: RestaurantsTransaction) => Promise<T>,
        ): Promise<T> {
          transactionSpy();
          throw new Error("Transaction should not be reached.");
        },
      },
    });

    await expect(
      handler.execute({
        userId: "invalid-user-id",
        name: "Test Restaurant",
      }),
    ).rejects.toThrow();

    expect(transactionSpy).not.toHaveBeenCalled();
  });
});
