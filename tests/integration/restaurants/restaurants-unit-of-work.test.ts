import { resolve } from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
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
import { CreateRestaurantHandler } from "#modules/restaurants/application/commands/create-restaurant.handler.js";
import { RestaurantMembership } from "#modules/restaurants/domain/restaurant-membership.js";
import { Restaurant } from "#modules/restaurants/domain/restaurant.js";
import { DrizzleRestaurantsUnitOfWork } from "#modules/restaurants/infrastructure/persistence/drizzle-restaurants-unit-of-work.js";

import type { Database } from "#infrastructure/database/client.js";

const createdAt = "2026-11-08T12:00:00.000Z";

const userId = "00000000-0000-4000-8000-000000000001";
const restaurantId = "00000000-0000-4000-8000-000000000002";
const membershipId = "00000000-0000-4000-8000-000000000003";

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
let pool: Pool;
let db: Database;
let unitOfWork: DrizzleRestaurantsUnitOfWork;

async function insertUser(): Promise<void> {
  await db.insert(users).values({
    id: userId,
    firstName: "Test",
    lastName: "User",
    email: "restaurant-owner@example.com",
    phone: "+15555550100",
    passwordHash: "$argon2id$synthetic-test-hash",
    status: "active",
  });
}

function createRestaurant(): Restaurant {
  return Restaurant.create({
    id: restaurantId,
    name: "Test Restaurant",
    createdAt,
    updatedAt: createdAt,
  });
}

function createMembership(
  membershipUserId: string = userId,
): RestaurantMembership {
  return RestaurantMembership.create({
    id: membershipId,
    restaurantId,
    userId: membershipUserId,
    role: "owner",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  });
}

describe("DrizzleRestaurantsUnitOfWork", () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("restaurant_cmv_test")
      .withUsername("test")
      .withPassword("test")
      .start();

    pool = new Pool({
      connectionString: container.getConnectionUri(),
      max: 5,
    });

    db = drizzle(pool, { schema });

    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    });

    unitOfWork = new DrizzleRestaurantsUnitOfWork(db);
  }, 120_000);

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        restaurant_memberships,
        restaurants,
        users
      CASCADE
    `);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    if (container) {
      await container.stop();
    }
  });

  it("commits the restaurant and its owner membership", async () => {
    await insertUser();

    const restaurant = createRestaurant();
    const membership = createMembership();

    await unitOfWork.transaction(async (transaction) => {
      await transaction.restaurants.insert(restaurant);
      await transaction.memberships.insert(membership);
    });

    const persistedRestaurants = await db.select().from(restaurants);
    const persistedMemberships = await db.select().from(restaurantMemberships);

    expect(persistedRestaurants).toHaveLength(1);
    expect(persistedMemberships).toHaveLength(1);

    expect(persistedRestaurants[0]).toMatchObject({
      id: restaurantId,
      name: "Test Restaurant",
    });

    expect(persistedMemberships[0]).toMatchObject({
      id: membershipId,
      restaurantId,
      userId,
      role: "owner",
      status: "active",
    });
  });

  it("rolls back the restaurant when owner membership insertion fails", async () => {
    const restaurant = createRestaurant();

    // This user does not exist, so the membership foreign key must fail.
    const invalidMembership = createMembership(
      "00000000-0000-4000-8000-000000000099",
    );

    await expect(
      unitOfWork.transaction(async (transaction) => {
        await transaction.restaurants.insert(restaurant);
        await transaction.memberships.insert(invalidMembership);
      }),
    ).rejects.toThrow();

    expect(await db.select().from(restaurants)).toHaveLength(0);
    expect(await db.select().from(restaurantMemberships)).toHaveLength(0);
  });

  it("creates a restaurant and its owner membership through the application handler", async () => {
    await insertUser();

    let generatedId = 0;

    const handler = new CreateRestaurantHandler({
      ids: {
        generate: () => {
          generatedId += 1;

          return generatedId === 1 ? restaurantId : membershipId;
        },
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
      restaurantId,
    });

    expect(await db.select().from(restaurants)).toMatchObject([
      {
        id: restaurantId,
        name: "Test Restaurant",
      },
    ]);

    expect(await db.select().from(restaurantMemberships)).toMatchObject([
      {
        id: membershipId,
        restaurantId,
        userId,
        role: "owner",
        status: "active",
      },
    ]);
  });
});
