import { resolve } from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "#infrastructure/database/schema/index.js";
import { outboxEvents } from "#infrastructure/database/schema/index.js";
import { DrizzleOutboxRepository } from "#modules/outbox/infrastructure/persistence/drizzle-outbox-repository.js";

import type { Database } from "#infrastructure/database/client.js";

const now = new Date("2026-11-07T15:00:00.000Z");

let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
let pool: Pool;
let db: Database;
let repository: DrizzleOutboxRepository;

function createEvent(
  id: string,
  overrides: Partial<typeof outboxEvents.$inferInsert> = {},
) {
  return {
    id,
    aggregateType: "user",
    aggregateId: "00000000-0000-4000-8000-000000000001",
    eventType: "identity.email_verification_requested.v1",
    payload: {
      userId: "00000000-0000-4000-8000-000000000001",
      tokenId: "00000000-0000-4000-8000-000000000002",
      expiresAt: "2026-11-08T15:00:00.000Z",
      occurredAt: now.toISOString(),
    },
    occurredAt: now,
    createdAt: now,
    availableAt: now,
    ...overrides,
  };
}

async function insertEvent(
  id: string,
  overrides: Partial<typeof outboxEvents.$inferInsert> = {},
): Promise<void> {
  await db.insert(outboxEvents).values(createEvent(id, overrides));
}

describe("DrizzleOutboxRepository", () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("orbis_outbox_test")
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

    repository = new DrizzleOutboxRepository(db);
  }, 120_000);

  beforeEach(async () => {
    await db.delete(outboxEvents);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }

    if (container) {
      await container.stop();
    }
  });

  it("claims pending events and increments their attempts", async () => {
    const eventId = "00000000-0000-4000-8000-000000000101";

    await insertEvent(eventId);

    const claimed = await repository.claimBatch({
      now,
      limit: 10,
      leaseDurationMs: 30_000,
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      id: eventId,
      eventType: "identity.email_verification_requested.v1",
      attempts: 1,
    });
    expect(claimed[0]?.leaseToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const [persisted] = await db.select().from(outboxEvents);

    expect(persisted?.leaseToken).toBe(claimed[0]?.leaseToken);
    expect(persisted?.leaseExpiresAt).toEqual(new Date(now.getTime() + 30_000));
    expect(persisted?.attempts).toBe(1);
  });

  it("does not claim the same event twice", async () => {
    const eventId = "00000000-0000-4000-8000-000000000102";

    await insertEvent(eventId);

    const firstBatch = await repository.claimBatch({
      now,
      limit: 10,
      leaseDurationMs: 30_000,
    });

    const secondBatch = await repository.claimBatch({
      now,
      limit: 10,
      leaseDurationMs: 30_000,
    });

    expect(firstBatch).toHaveLength(1);
    expect(secondBatch).toHaveLength(0);
  });

  it("allows concurrent workers to claim distinct events", async () => {
    const eventIds = [
      "00000000-0000-4000-8000-000000000111",
      "00000000-0000-4000-8000-000000000112",
      "00000000-0000-4000-8000-000000000113",
      "00000000-0000-4000-8000-000000000114",
    ];

    for (const eventId of eventIds) {
      await insertEvent(eventId);
    }

    const [firstBatch, secondBatch] = await Promise.all([
      repository.claimBatch({
        now,
        limit: 3,
        leaseDurationMs: 30_000,
      }),
      repository.claimBatch({
        now,
        limit: 3,
        leaseDurationMs: 30_000,
      }),
    ]);

    const claimedIds = [
      ...firstBatch.map((event) => event.id),
      ...secondBatch.map((event) => event.id),
    ];

    expect(claimedIds).toHaveLength(4);
    expect(new Set(claimedIds).size).toBe(4);
    expect(claimedIds.sort()).toEqual(eventIds.sort());
  });

  it("reclaims an event after its lease expires", async () => {
    const eventId = "00000000-0000-4000-8000-000000000103";

    await insertEvent(eventId);

    const firstClaim = await repository.claimBatch({
      now,
      limit: 1,
      leaseDurationMs: 1_000,
    });

    const firstLeaseToken = firstClaim[0]?.leaseToken;

    expect(firstLeaseToken).toBeDefined();

    const secondClaim = await repository.claimBatch({
      now: new Date(now.getTime() + 1_001),
      limit: 1,
      leaseDurationMs: 30_000,
    });

    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0]?.id).toBe(eventId);
    expect(secondClaim[0]?.leaseToken).not.toBe(firstLeaseToken);
    expect(secondClaim[0]?.attempts).toBe(2);
  });

  it("rejects acknowledgement from a stale worker", async () => {
    const eventId = "00000000-0000-4000-8000-000000000104";

    await insertEvent(eventId);

    const firstClaim = await repository.claimBatch({
      now,
      limit: 1,
      leaseDurationMs: 1_000,
    });

    const firstLeaseToken = firstClaim[0]?.leaseToken;

    expect(firstLeaseToken).toBeDefined();

    const secondClaim = await repository.claimBatch({
      now: new Date(now.getTime() + 1_001),
      limit: 1,
      leaseDurationMs: 30_000,
    });

    const secondLeaseToken = secondClaim[0]?.leaseToken;

    expect(secondLeaseToken).toBeDefined();

    const acknowledged = await repository.markPublished({
      eventId,
      leaseToken: firstLeaseToken!,
      publishedAt: new Date(now.getTime() + 2_000),
    });

    expect(acknowledged).toBe(false);

    const [persisted] = await db.select().from(outboxEvents);

    expect(persisted?.publishedAt).toBeNull();
    expect(persisted?.leaseToken).toBe(secondLeaseToken);
  });

  it("acknowledges an event owned by the current worker", async () => {
    const eventId = "00000000-0000-4000-8000-000000000105";

    await insertEvent(eventId);

    const [claimed] = await repository.claimBatch({
      now,
      limit: 1,
      leaseDurationMs: 30_000,
    });

    expect(claimed).toBeDefined();

    const publishedAt = new Date(now.getTime() + 500);

    const acknowledged = await repository.markPublished({
      eventId,
      leaseToken: claimed!.leaseToken,
      publishedAt,
    });

    expect(acknowledged).toBe(true);

    const [persisted] = await db.select().from(outboxEvents);

    expect(persisted?.publishedAt).toEqual(publishedAt);
    expect(persisted?.leaseToken).toBeNull();
    expect(persisted?.leaseExpiresAt).toBeNull();
    expect(persisted?.lastError).toBeNull();
  });

  it("schedules a retry after a failed publication", async () => {
    const eventId = "00000000-0000-4000-8000-000000000106";

    await insertEvent(eventId);

    const [claimed] = await repository.claimBatch({
      now,
      limit: 1,
      leaseDurationMs: 30_000,
    });

    expect(claimed).toBeDefined();

    const failedAt = new Date(now.getTime() + 500);
    const nextAvailableAt = new Date(now.getTime() + 60_000);

    const result = await repository.markFailed({
      eventId,
      leaseToken: claimed!.leaseToken,
      failedAt,
      nextAvailableAt,
      error: "Synthetic publisher failure",
      maxAttempts: 5,
    });

    expect(result).toBe("retry_scheduled");

    const [persisted] = await db.select().from(outboxEvents);

    expect(persisted?.availableAt).toEqual(nextAvailableAt);
    expect(persisted?.deadLetteredAt).toBeNull();
    expect(persisted?.leaseToken).toBeNull();
    expect(persisted?.leaseExpiresAt).toBeNull();
    expect(persisted?.lastError).toBe("Synthetic publisher failure");
  });

  it("dead-letters an event after the maximum number of attempts", async () => {
    const eventId = "00000000-0000-4000-8000-000000000107";

    await insertEvent(eventId, { attempts: 4 });

    const [claimed] = await repository.claimBatch({
      now,
      limit: 1,
      leaseDurationMs: 30_000,
    });

    expect(claimed?.attempts).toBe(5);

    const failedAt = new Date(now.getTime() + 500);

    const result = await repository.markFailed({
      eventId,
      leaseToken: claimed!.leaseToken,
      failedAt,
      nextAvailableAt: new Date(now.getTime() + 60_000),
      error: "Synthetic permanent publisher failure",
      maxAttempts: 5,
    });

    expect(result).toBe("dead_lettered");

    const [persisted] = await db.select().from(outboxEvents);

    expect(persisted?.deadLetteredAt).toEqual(failedAt);
    expect(persisted?.leaseToken).toBeNull();
    expect(persisted?.leaseExpiresAt).toBeNull();
    expect(persisted?.lastError).toBe("Synthetic permanent publisher failure");

    const claimedAgain = await repository.claimBatch({
      now: new Date(now.getTime() + 120_000),
      limit: 1,
      leaseDurationMs: 30_000,
    });

    expect(claimedAgain).toHaveLength(0);
  });

  it("does not modify an event when a stale worker reports failure", async () => {
    const eventId = "00000000-0000-4000-8000-000000000108";

    await insertEvent(eventId);

    const [firstClaim] = await repository.claimBatch({
      now,
      limit: 1,
      leaseDurationMs: 1_000,
    });

    expect(firstClaim).toBeDefined();

    const secondClaim = await repository.claimBatch({
      now: new Date(now.getTime() + 1_001),
      limit: 1,
      leaseDurationMs: 30_000,
    });

    expect(secondClaim).toHaveLength(1);

    const result = await repository.markFailed({
      eventId,
      leaseToken: firstClaim!.leaseToken,
      failedAt: new Date(now.getTime() + 2_000),
      nextAvailableAt: new Date(now.getTime() + 60_000),
      error: "Stale worker failure",
      maxAttempts: 5,
    });

    expect(result).toBe("lease_lost");

    const [persisted] = await db.select().from(outboxEvents);

    expect(persisted?.leaseToken).toBe(secondClaim[0]?.leaseToken);
    expect(persisted?.lastError).toBeNull();
  });

  it("rejects invalid claim limits and lease durations", async () => {
    await expect(
      repository.claimBatch({
        now,
        limit: 0,
        leaseDurationMs: 30_000,
      }),
    ).rejects.toThrow("Claim limit must be a positive integer.");

    await expect(
      repository.claimBatch({
        now,
        limit: 1,
        leaseDurationMs: 0,
      }),
    ).rejects.toThrow("Lease duration must be greater than zero.");
  });
});
