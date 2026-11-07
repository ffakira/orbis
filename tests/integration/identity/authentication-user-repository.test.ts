import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";

import * as schema from "../../../src/infrastructure/database/schema/index.js";
import { users } from "../../../src/infrastructure/database/schema/index.js";

import { DrizzleAuthenticationUserRepository } from "../../../src/infrastructure/database/identity/repositories/drizzle-authentication-user-repository.js";

import { Email } from "../../../src/modules/identity/domain/value-objects/email.js";

import type { Database } from "../../../src/infrastructure/database/client.js";

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
let pool: Pool;
let db: Database;
let repository: DrizzleAuthenticationUserRepository;

async function insertUser(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<void> {
  await db.insert(users).values({
    id: "00000000-0000-4000-8000-000000000001",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "+15555550100",
    passwordHash: "$argon2id$synthetic-test-hash",
    status: "active",
    ...overrides,
  });
}

describe("DrizzleAuthenticationUserRepository", () => {
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

    repository = new DrizzleAuthenticationUserRepository(db);
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

  it("finds an existing user by email", async () => {
    await insertUser();

    const result = await repository.findByEmail(
      Email.create("test@example.com"),
    );

    expect(result).toEqual({
      userId: "00000000-0000-4000-8000-000000000001",
      passwordHash: "$argon2id$synthetic-test-hash",
      status: "active",
    });
  });

  it("returns null when the email does not exist", async () => {
    const result = await repository.findByEmail(
      Email.create("unknown@example.com"),
    );

    expect(result).toBeNull();
  });

  it("normalises the email before querying", async () => {
    await insertUser();

    const result = await repository.findByEmail(
      Email.create("  TEST@Example.COM  "),
    );

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it.each(["pending_email_verification", "suspended"] as const)(
    "returns the %s account status",
    async (status) => {
      await insertUser({ status });

      const result = await repository.findByEmail(
        Email.create("test@example.com"),
      );

      expect(result?.status).toBe(status);
    },
  );
});
