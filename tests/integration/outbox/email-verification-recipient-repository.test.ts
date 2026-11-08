import { resolve } from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "#infrastructure/database/schema/index.js";
import { users } from "#infrastructure/database/schema/index.js";
import { DrizzleEmailVerificationRecipientRepository } from "#modules/outbox/infrastructure/persistence/drizzle-email-verification-recipient-repository.js";

import type { Database } from "#infrastructure/database/client.js";

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
let pool: Pool;
let db: Database;
let repository: DrizzleEmailVerificationRecipientRepository;

async function insertUser(
  id: string,
  status: "pending_email_verification" | "active" | "suspended",
): Promise<void> {
  await db.insert(users).values({
    id,
    firstName: "Test",
    lastName: "User",
    email: `${id}@example.com`,
    phone: "+15555550100",
    passwordHash: "$argon2id$synthetic-test-hash",
    status,
  });
}

describe("DrizzleEmailVerificationRecipientRepository", () => {
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

    repository = new DrizzleEmailVerificationRecipientRepository(db);
  }, 120_000);

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE users CASCADE");
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    if (container) {
      await container.stop();
    }
  });

  it("returns the email and first name of a pending user", async () => {
    const userId = "00000000-0000-4000-8000-000000000001";

    await insertUser(userId, "pending_email_verification");

    const recipient = await repository.findPendingByUserId(userId);

    expect(recipient).toEqual({
      email: `${userId}@example.com`,
      firstName: "Test",
    });
  });

  it.each(["active", "suspended"] as const)(
    "returns null for a %s user",
    async (status) => {
      const userId = "00000000-0000-4000-8000-000000000002";

      await insertUser(userId, status);

      const recipient = await repository.findPendingByUserId(userId);

      expect(recipient).toBeNull();
    },
  );

  it("returns null when the user does not exist", async () => {
    const recipient = await repository.findPendingByUserId(
      "00000000-0000-4000-8000-000000000099",
    );

    expect(recipient).toBeNull();
  });
});
