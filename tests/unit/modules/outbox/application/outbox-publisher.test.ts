import { describe, expect, it, vi } from "vitest";

import { OutboxPublisher } from "#modules/outbox/application/outbox-publisher.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { OutboxPublisherConfig } from "#modules/outbox/application/outbox-publisher.schema.js";
import type { OutboxEventDispatcher } from "#modules/outbox/application/ports/outbox-event-dispatcher.js";
import type {
  ClaimedOutboxEvent,
  OutboxRepository,
} from "#modules/outbox/application/ports/outbox-repository.js";

const now = new Date("2026-11-07T12:00:00.000Z");

const defaultConfig: OutboxPublisherConfig = {
  batchSize: 10,
  leaseDurationMs: 30_000,
  maxAttempts: 5,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 60_000,
};

const event: ClaimedOutboxEvent = {
  id: "event-123",
  eventType: "identity.email_verification_requested.v1",
  payload: {
    userId: "550e8400-e29b-41d4-a716-446655440000",
    tokenId: "550e8400-e29b-41d4-a716-446655440001",
    expiresAt: "2026-11-08T12:00:00.000Z",
    occurredAt: "2026-11-07T11:00:00.000Z",
  },
  attempts: 1,
  leaseToken: "lease-token-123",
};

function createRepository(): OutboxRepository {
  return {
    claimBatch: vi.fn(async () => [event]),
    markPublished: vi.fn(async () => true),
    markFailed: vi.fn(
      async (): Promise<"retry_scheduled"> => "retry_scheduled",
    ),
  };
}

function createPublisher(
  repository: OutboxRepository = createRepository(),
  dispatcher: OutboxEventDispatcher = {
    dispatch: vi.fn(async () => {}),
  },
  config: OutboxPublisherConfig = defaultConfig,
) {
  const clock: Clock = {
    now: vi.fn(() => now),
  };

  const publisher = new OutboxPublisher({
    clock,
    dispatcher,
    repository,
    config,
  });

  return {
    publisher,
    clock,
    repository,
    dispatcher,
  };
}

describe("OutboxPublisher", () => {
  it("claims a batch and publishes all claimed events", async () => {
    const repository = createRepository();

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {}),
    };

    const { publisher, clock } = createPublisher(repository, dispatcher);

    const result = await publisher.publishBatch();

    expect(result).toEqual({
      claimed: 1,
      published: 1,
      failed: 0,
      deadLettered: 0,
      leaseLost: 0,
    });

    expect(repository.claimBatch).toHaveBeenCalledOnce();

    expect(repository.claimBatch).toHaveBeenCalledWith({
      now,
      limit: defaultConfig.batchSize,
      leaseDurationMs: defaultConfig.leaseDurationMs,
    });

    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(event);

    expect(repository.markPublished).toHaveBeenCalledOnce();

    expect(repository.markPublished).toHaveBeenCalledWith({
      eventId: event.id,
      leaseToken: event.leaseToken,
      publishedAt: now,
    });

    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(clock.now).toHaveBeenCalledTimes(2);
  });

  it("returns an empty result when no events are available", async () => {
    const repository = createRepository();

    vi.mocked(repository.claimBatch).mockResolvedValue([]);

    const { publisher, dispatcher } = createPublisher(repository);

    const result = await publisher.publishBatch();

    expect(result).toEqual({
      claimed: 0,
      published: 0,
      failed: 0,
      deadLettered: 0,
      leaseLost: 0,
    });

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("schedules a retry when event dispatch fails", async () => {
    const repository = createRepository();

    const dispatchError = new Error("Email provider unavailable.");

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {
        throw dispatchError;
      }),
    };

    const { publisher } = createPublisher(repository, dispatcher);

    const result = await publisher.publishBatch();

    expect(result).toEqual({
      claimed: 1,
      published: 0,
      failed: 1,
      deadLettered: 0,
      leaseLost: 0,
    });

    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledOnce();

    expect(repository.markFailed).toHaveBeenCalledWith({
      eventId: event.id,
      leaseToken: event.leaseToken,
      failedAt: now,
      nextAvailableAt: new Date(now.getTime() + defaultConfig.retryBaseDelayMs),
      error: dispatchError.message,
      maxAttempts: defaultConfig.maxAttempts,
    });
  });

  it("uses exponential backoff based on the attempt count", async () => {
    const repository = createRepository();

    const thirdAttempt: ClaimedOutboxEvent = {
      ...event,
      attempts: 3,
    };

    vi.mocked(repository.claimBatch).mockResolvedValue([thirdAttempt]);

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {
        throw new Error("Temporary provider failure.");
      }),
    };

    const { publisher } = createPublisher(repository, dispatcher);

    await publisher.publishBatch();

    expect(repository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        nextAvailableAt: new Date(now.getTime() + 4_000),
      }),
    );
  });

  it("caps exponential backoff at the configured maximum delay", async () => {
    const repository = createRepository();

    const laterAttempt: ClaimedOutboxEvent = {
      ...event,
      attempts: 10,
    };

    vi.mocked(repository.claimBatch).mockResolvedValue([laterAttempt]);

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {
        throw new Error("Temporary provider failure.");
      }),
    };

    const { publisher } = createPublisher(repository, dispatcher);

    await publisher.publishBatch();

    expect(repository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        nextAvailableAt: new Date(
          now.getTime() + defaultConfig.retryMaxDelayMs,
        ),
      }),
    );
  });

  it("dead-letters an event when its maximum attempts are reached", async () => {
    const repository = createRepository();

    const finalAttempt: ClaimedOutboxEvent = {
      ...event,
      attempts: defaultConfig.maxAttempts,
    };

    vi.mocked(repository.claimBatch).mockResolvedValue([finalAttempt]);

    vi.mocked(repository.markFailed).mockResolvedValue("dead_lettered");

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {
        throw new Error("Permanent delivery failure.");
      }),
    };

    const { publisher } = createPublisher(repository, dispatcher);

    const result = await publisher.publishBatch();

    expect(result).toEqual({
      claimed: 1,
      published: 0,
      failed: 0,
      deadLettered: 1,
      leaseLost: 0,
    });

    expect(repository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAttempts: defaultConfig.maxAttempts,
      }),
    );
  });

  it("reports a lost lease when acknowledgement returns false", async () => {
    const repository = createRepository();

    vi.mocked(repository.markPublished).mockResolvedValue(false);

    const { publisher } = createPublisher(repository);

    const result = await publisher.publishBatch();

    expect(result).toEqual({
      claimed: 1,
      published: 0,
      failed: 0,
      deadLettered: 0,
      leaseLost: 1,
    });

    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("reports a lost lease when failure recording returns lease_lost", async () => {
    const repository = createRepository();

    vi.mocked(repository.markFailed).mockResolvedValue("lease_lost");

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {
        throw new Error("Provider failure.");
      }),
    };

    const { publisher } = createPublisher(repository, dispatcher);

    const result = await publisher.publishBatch();

    expect(result).toEqual({
      claimed: 1,
      published: 0,
      failed: 0,
      deadLettered: 0,
      leaseLost: 1,
    });
  });

  it("propagates acknowledgement errors without treating them as dispatch failures", async () => {
    const repository = createRepository();

    const databaseError = new Error("Database acknowledgement failed.");

    vi.mocked(repository.markPublished).mockRejectedValue(databaseError);

    const dispatcher: OutboxEventDispatcher = {
      dispatch: vi.fn(async () => {}),
    };

    const { publisher } = createPublisher(repository, dispatcher);

    await expect(publisher.publishBatch()).rejects.toBe(databaseError);

    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
    expect(repository.markPublished).toHaveBeenCalledOnce();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("rejects invalid publisher configuration", () => {
    const repository = createRepository();

    const invalidConfig: OutboxPublisherConfig = {
      ...defaultConfig,
      retryBaseDelayMs: 10_000,
      retryMaxDelayMs: 5_000,
    };

    expect(() =>
      createPublisher(repository, undefined, invalidConfig),
    ).toThrow();
  });
});
