import { resolve } from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "#infrastructure/database/schema/index.js";
import {
  users,
  termsAcceptances,
  emailVerificationTokens,
  outboxEvents,
} from "#infrastructure/database/schema/index.js";
import { EmailAlreadyRegisteredError } from "#modules/identity/application/email-already-registered.error.js";
import { EmailVerificationRequested } from "#modules/identity/domain/email-verification-requested.event.js";
import { EmailVerificationToken } from "#modules/identity/domain/email-verification-token.js";
import { TermsAcceptance } from "#modules/identity/domain/terms-acceptance.js";
import { User } from "#modules/identity/domain/user.js";
import { Email } from "#modules/identity/domain/value-objects/email.js";
import { DrizzleIdentityUnitOfWork } from "#modules/identity/infrastructure/persistence/drizzle-identity-unit-of-work.js";

import type { Database } from "#infrastructure/database/client.js";

const registeredAt = "2026-11-07T11:00:00.000Z";
const expiresAt = "2026-11-08T11:00:00.000Z";

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
    firstName: "Test",
    lastName: "User",
    email: Email.create(email),
    phone: "+15555550100",
    passwordHash: "$argon2id$synthetic-test-hash",
    registeredAt,
  });

  const acceptance = TermsAcceptance.record({
    id: acceptanceId,
    userId,
    document: "terms_of_service",
    version: "2026-11-01",
    acceptedAt: registeredAt,
  });

  const token = EmailVerificationToken.create({
    id: acceptanceId,
    userId,
    tokenHash: "a".repeat(64),
    createdAt: new Date(registeredAt),
    expiresAt: new Date(expiresAt),
  });

  const event = new EmailVerificationRequested(
    eventId,
    userId,
    token.id,
    expiresAt,
    registeredAt,
  );

  return { user, acceptance, token, event };
}

async function persistRegistration(
  registration: ReturnType<typeof createRegistration>,
): Promise<void> {
  await unitOfWork.transaction(async (transaction) => {
    await transaction.users.insert(registration.user);
    await transaction.termsAcceptances.insert(registration.acceptance);
    await transaction.emailVerificationTokens.insert(registration.token);
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
        email_verification_tokens,
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

  it("commits the user, terms acceptance, verification token and outbox event", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "test@example.com",
    );

    await persistRegistration(registration);

    const persistedUsers = await db.select().from(users);
    const persistedAcceptances = await db.select().from(termsAcceptances);
    const persistedTokens = await db.select().from(emailVerificationTokens);
    const persistedEvents = await db.select().from(outboxEvents);

    expect(persistedUsers).toHaveLength(1);
    expect(persistedAcceptances).toHaveLength(1);
    expect(persistedTokens).toHaveLength(1);
    expect(persistedEvents).toHaveLength(1);

    expect(persistedUsers[0]?.email).toBe("test@example.com");
    expect(persistedAcceptances[0]?.userId).toBe(registration.user.id);
    expect(persistedTokens[0]?.userId).toBe(registration.user.id);

    expect(persistedEvents[0]?.eventType).toBe(
      "identity.email_verification_requested.v1",
    );
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
        await transaction.emailVerificationTokens.insert(registration.token);
        await transaction.outbox.append(registration.event);
      }),
    ).rejects.toThrow();

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(termsAcceptances)).toHaveLength(0);
    expect(await db.select().from(emailVerificationTokens)).toHaveLength(0);
    expect(await db.select().from(outboxEvents)).toHaveLength(0);
  });

  it("rolls back user, terms acceptance and token when outbox insertion fails", async () => {
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
        tokenId: registration.event.tokenId,
        expiresAt: registration.event.expiresAt,
        occurredAt: registration.event.occurredAt,
      },
      occurredAt: new Date(registration.event.occurredAt),
    });

    await expect(persistRegistration(registration)).rejects.toThrow();

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(termsAcceptances)).toHaveLength(0);
    expect(await db.select().from(emailVerificationTokens)).toHaveLength(0);

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
    expect(await db.select().from(emailVerificationTokens)).toHaveLength(1);
    expect(await db.select().from(outboxEvents)).toHaveLength(1);
  });

  it("persists an email verification token within the identity transaction", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000051",
      "00000000-0000-4000-8000-000000000052",
      "00000000-0000-4000-8000-000000000053",
      "token-persistence@example.com",
    );

    await persistRegistration(registration);

    const persistedTokens = await db.select().from(emailVerificationTokens);

    expect(persistedTokens).toHaveLength(1);
    expect(persistedTokens[0]?.id).toBe(registration.token.id);
    expect(persistedTokens[0]?.userId).toBe(registration.user.id);
    expect(persistedTokens[0]?.tokenHash).toBe("a".repeat(64));
    expect(persistedTokens[0]?.expiresAt).toEqual(registration.token.expiresAt);
    expect(persistedTokens[0]?.consumedAt).toBeNull();
    expect(persistedTokens[0]?.revokedAt).toBeNull();
  });

  it("rolls back the email verification token when a later operation fails", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000061",
      "00000000-0000-4000-8000-000000000062",
      "00000000-0000-4000-8000-000000000063",
      "token-rollback@example.com",
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
        await transaction.emailVerificationTokens.insert(registration.token);

        // This fails because the referenced user does not exist.
        await transaction.termsAcceptances.insert(invalidAcceptance);

        await transaction.outbox.append(registration.event);
      }),
    ).rejects.toThrow();

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(emailVerificationTokens)).toHaveLength(0);
    expect(await db.select().from(termsAcceptances)).toHaveLength(0);
    expect(await db.select().from(outboxEvents)).toHaveLength(0);
  });

  it("consumes a valid token and activates the user atomically", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000071",
      "00000000-0000-4000-8000-000000000072",
      "00000000-0000-4000-8000-000000000073",
      "verification-success@example.com",
    );

    const consumedAt = new Date("2026-11-07T12:00:00.000Z");

    await unitOfWork.transaction(async (transaction) => {
      await transaction.users.insert(registration.user);
      await transaction.emailVerificationTokens.insert(registration.token);

      const userId = await transaction.emailVerificationTokens.consume(
        registration.token.tokenHash,
        consumedAt,
      );

      expect(userId).toBe(registration.user.id);

      const activated = await transaction.users.activate(userId!, consumedAt);

      expect(activated).toBe(true);

      // A second consumption attempt must fail.
      const replayedUserId = await transaction.emailVerificationTokens.consume(
        registration.token.tokenHash,
        consumedAt,
      );

      expect(replayedUserId).toBeNull();
    });

    const [persistedUser] = await db.select().from(users);
    const [persistedToken] = await db.select().from(emailVerificationTokens);

    expect(persistedUser?.status).toBe("active");
    expect(persistedUser?.updatedAt).toEqual(consumedAt);
    expect(persistedToken?.consumedAt).toEqual(consumedAt);
  });

  it("rolls back token consumption when user activation fails", async () => {
    const registration = createRegistration(
      "00000000-0000-4000-8000-000000000081",
      "00000000-0000-4000-8000-000000000082",
      "00000000-0000-4000-8000-000000000083",
      "verification-rollback@example.com",
    );

    const consumedAt = new Date("2026-11-07T12:00:00.000Z");

    await unitOfWork.transaction(async (transaction) => {
      await transaction.users.insert(registration.user);
      await transaction.emailVerificationTokens.insert(registration.token);
    });

    // Simulate an account that has already been activated.
    await db
      .update(users)
      .set({ status: "active" })
      .where(eq(users.id, registration.user.id));

    await expect(
      unitOfWork.transaction(async (transaction) => {
        const userId = await transaction.emailVerificationTokens.consume(
          registration.token.tokenHash,
          consumedAt,
        );

        expect(userId).toBe(registration.user.id);

        const activated = await transaction.users.activate(userId!, consumedAt);

        if (!activated) {
          throw new Error("User cannot be activated.");
        }
      }),
    ).rejects.toThrow("User cannot be activated.");

    const [persistedToken] = await db.select().from(emailVerificationTokens);

    // The transaction rolled back, so the token remains unconsumed.
    expect(persistedToken?.consumedAt).toBeNull();
  });
});
