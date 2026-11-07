import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";

import * as schema from "../../../src/infrastructure/database/schema/index.js";
import {
  users,
  termsAcceptances,
  outboxEvents,
} from "../../../src/infrastructure/database/schema/index.js";

import { DrizzleIdentityUnitOfWork } from "../../../src/modules/identity/infrastructure/persistence/drizzle-identity-unit-of-work.js";

import { User } from "../../../src/modules/identity/domain/user.js";
import { Email } from "../../../src/modules/identity/domain/value-objects/email.js";
import { TermsAcceptance } from "../../../src/modules/identity/domain/terms-acceptance.js";
import { EmailAlreadyRegisteredError } from "../../../src/modules/identity/application/email-already-registered.error.js";

import type { Database } from "../../../src/infrastructure/database/client.js";

const registeredAt = "2026-11-07T11:00:00.000Z";

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
let pool: Pool;
let db: Database;
let unitOfWork: DrizzleIdentityUnitOfWork;

function createRegistration(
  userId: string,
  eventId: string,
  acceptanceId: string,
  email: string,
) {
  const user = User.register({
    id: userId,
    eventId,
    firstName: "Test",
    lastName: "User",
    email: Email.create(email),
    phone: "+15555550100",
    passwordHash: "$argon2id$synthetic-test-hash",
    registeredAt,
  });

  const events = user.pullDomainEvents();
  const event = events[0];

  if (!event) {
    throw new Error("Expected UserRegistered domain event.");
  }

  const acceptance = TermsAcceptance.record({
    id: acceptanceId,
    userId,
    document: "terms_of_service",
    version: "2026-11-01",
    acceptedAt: registeredAt,
  });

  return { user, acceptance, event };
}

async function persistRegistration(
  registration: ReturnType<typeof createRegistration>,
): Promise<void> {
  await unitOfWork.transaction(async (transaction) => {
    await transaction.users.insert(registration.user);
    await transaction.termsAcceptances.insert(registration.acceptance);
    await transaction.outbox.append(registration.event);
  });
}

describe("DrizzleIdentityUnitOfWork", () => {
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

    unitOfWork = new DrizzleIdentityUnitOfWork(db);
  }, 120_000);

  beforeEach(async () => {
    await pool.query(`
            TRUNCATE TABLE
                outbox_events,
                terms_acceptances,
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

  it("commits the user, terms acceptance and outbox event", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "test@example.com",
    );

    await persistRegistration(registration);

    const persistedUsers = await db.select().from(users);
    const persistedAcceptances = await db.select().from(termsAcceptances);
    const persistedEvents = await db.select().from(outboxEvents);

    expect(persistedUsers).toHaveLength(1);
    expect(persistedAcceptances).toHaveLength(1);
    expect(persistedEvents).toHaveLength(1);

    expect(persistedUsers[0]?.email).toBe("test@example.com");
    expect(persistedAcceptances[0]?.userId).toBe(registration.user.id);
    expect(persistedEvents[0]?.eventType).toBe("identity.user_registered.v1");
  });

  it("rolls back the user when terms acceptance insertion fails", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000012",
      "00000000-0000-4000-8000-000000000013",
      "rollback@example.com",
    );

    const invalidAcceptance = TermsAcceptance.record({
      id: registration.acceptance.id,
      userId: "00000000-0000-4000-8000-000000000099",
      document: "terms_of_service",
      version: "2026-11-01",
      acceptedAt: registeredAt,
    });

    await expect(
      unitOfWork.transaction(async (transaction) => {
        await transaction.users.insert(registration.user);
        await transaction.termsAcceptances.insert(invalidAcceptance);
        await transaction.outbox.append(registration.event);
      }),
    ).rejects.toThrow();

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(termsAcceptances)).toHaveLength(0);
    expect(await db.select().from(outboxEvents)).toHaveLength(0);
  });

  it("rolls back user and terms acceptance when outbox insertion fails", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000021",
      "00000000-0000-4000-8000-000000000022",
      "00000000-0000-4000-8000-000000000023",
      "outbox-rollback@example.com",
    );

    await db.insert(outboxEvents).values({
      id: registration.event.id,
      aggregateType: "user",
      aggregateId: registration.event.userId,
      eventType: registration.event.type,
      payload: {
        userId: registration.event.userId,
        occurredAt: registration.event.occurredAt,
      },
      occurredAt: new Date(registration.event.occurredAt),
    });

    await expect(persistRegistration(registration)).rejects.toThrow();

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(termsAcceptances)).toHaveLength(0);

    // The original event remains. Only the failed transaction was rolled back.
    expect(await db.select().from(outboxEvents)).toHaveLength(1);
  });

  it("translates duplicate email into EmailAlreadyRegisteredError and rolls back", async () => {
    const first = createRegistration(
      "00000000-0000-4000-8000-000000000031",
      "00000000-0000-4000-8000-000000000032",
      "00000000-0000-4000-8000-000000000033",
      "duplicate@example.com",
    );

    const second = createRegistration(
      "00000000-0000-4000-8000-000000000041",
      "00000000-0000-4000-8000-000000000042",
      "00000000-0000-4000-8000-000000000043",
      "duplicate@example.com",
    );

    await persistRegistration(first);

    await expect(persistRegistration(second)).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );

    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(termsAcceptances)).toHaveLength(1);
    expect(await db.select().from(outboxEvents)).toHaveLength(1);
  });
});
