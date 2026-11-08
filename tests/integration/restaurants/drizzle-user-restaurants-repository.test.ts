import { resolve } from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "#infrastructure/database/schema/index.js";
import {
  restaurantMemberships,
  restaurants,
  users,
} from "#infrastructure/database/schema/index.js";
import { DrizzleUserRestaurantsRepository } from "#modules/restaurants/infrastructure/persistence/repositories/drizzle-user-restaurants-repository.js";

import type { Database } from "#infrastructure/database/client.js";

describe("DrizzleUserRestaurantsRepository", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";
  const otherUserId = "550e8400-e29b-41d4-a716-446655440001";
  const restaurantOneId = "660e8400-e29b-41d4-a716-446655440000";
  const restaurantTwoId = "660e8400-e29b-41d4-a716-446655440001";
  const otherRestaurantId = "660e8400-e29b-41d4-a716-446655440002";

  let pool: Pool | undefined;
  let db: Database;
  let stopContainer: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("restaurant_cmv_test")
      .withUsername("test")
      .withPassword("test")
      .start();

    stopContainer = () => container.stop();

    pool = new Pool({
      connectionString: container.getConnectionUri(),
      max: 5,
    });

    db = drizzle(pool, { schema });

    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });
  });

  afterAll(async () => {
    await pool?.end();
    await stopContainer?.();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE restaurant_memberships, restaurants, users CASCADE`,
    );
  });

  async function insertUser(id: string, email: string): Promise<void> {
    await db.insert(users).values({
      id,
      firstName: "Test",
      lastName: "User",
      email,
      phone: `+1555${id.slice(-7)}`,
      passwordHash: "$argon2id$test",
      status: "active",
    });
  }

  async function insertRestaurant(id: string, name: string): Promise<void> {
    await db.insert(restaurants).values({
      id,
      name,
    });
  }

  it("returns all restaurant memberships belonging to the user", async () => {
    await insertUser(userId, "owner@example.test");
    await insertUser(otherUserId, "other@example.test");

    await insertRestaurant(restaurantOneId, "Restaurant One");
    await insertRestaurant(restaurantTwoId, "Restaurant Two");
    await insertRestaurant(otherRestaurantId, "Other Restaurant");

    const activeJoinedAt = new Date("2026-01-15T10:00:00.000Z");
    const suspendedJoinedAt = new Date("2026-02-10T12:00:00.000Z");

    await db.insert(restaurantMemberships).values([
      {
        id: "770e8400-e29b-41d4-a716-446655440000",
        restaurantId: restaurantOneId,
        userId,
        role: "owner",
        status: "active",
        createdAt: activeJoinedAt,
        updatedAt: activeJoinedAt,
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440001",
        restaurantId: restaurantTwoId,
        userId,
        role: "staff",
        status: "suspended",
        createdAt: suspendedJoinedAt,
        updatedAt: suspendedJoinedAt,
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440002",
        restaurantId: otherRestaurantId,
        userId: otherUserId,
        role: "manager",
        status: "active",
        createdAt: new Date("2026-03-01T09:00:00.000Z"),
        updatedAt: new Date("2026-03-01T09:00:00.000Z"),
      },
    ]);

    const repository = new DrizzleUserRestaurantsRepository(db);

    const result = await repository.findByUserId(userId);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          id: restaurantOneId,
          name: "Restaurant One",
          role: "owner",
          membershipStatus: "active",
          joinedAt: activeJoinedAt,
        },
        {
          id: restaurantTwoId,
          name: "Restaurant Two",
          role: "staff",
          membershipStatus: "suspended",
          joinedAt: suspendedJoinedAt,
        },
      ]),
    );

    expect(result.map((restaurant) => restaurant.id)).not.toContain(
      otherRestaurantId,
    );
  });

  it("returns an empty array when the user has no memberships", async () => {
    await insertUser(userId, "owner@example.test");

    const repository = new DrizzleUserRestaurantsRepository(db);

    await expect(repository.findByUserId(userId)).resolves.toEqual([]);
  });
});
