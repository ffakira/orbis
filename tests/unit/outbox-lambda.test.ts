import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOutboxLambdaHandler,
  type OutboxLambdaDependencies,
} from "../../src/outbox-lambda.js";

import type {
  OutboxPublishResult,
  OutboxPublisher,
} from "#modules/outbox/application/outbox-publisher.js";

const publishResult: OutboxPublishResult = {
  claimed: 3,
  published: 2,
  failed: 1,
  deadLettered: 0,
  leaseLost: 0,
};

function createDependencies(
  overrides: Partial<OutboxLambdaDependencies> = {},
): OutboxLambdaDependencies {
  const publisher = {
    publishBatch: vi.fn(async () => publishResult),
  } as unknown as OutboxPublisher;

  return {
    getPublisher: vi.fn(async () => publisher),
    ...overrides,
  };
}

describe("Outbox Lambda handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initialises the publisher and processes one batch", async () => {
    const dependencies = createDependencies();
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const handler = createOutboxLambdaHandler(dependencies);

    const result = await handler();

    expect(result).toEqual(publishResult);
    expect(dependencies.getPublisher).toHaveBeenCalledOnce();

    expect(logSpy).toHaveBeenCalledWith(
      "Outbox batch processed.",
      publishResult,
    );
  });

  it("returns an empty batch result when no events are available", async () => {
    const emptyResult: OutboxPublishResult = {
      claimed: 0,
      published: 0,
      failed: 0,
      deadLettered: 0,
      leaseLost: 0,
    };

    const publisher = {
      publishBatch: vi.fn(async () => emptyResult),
    } as unknown as OutboxPublisher;

    const dependencies = createDependencies({
      getPublisher: vi.fn(async () => publisher),
    });

    const handler = createOutboxLambdaHandler(dependencies);

    await expect(handler()).resolves.toEqual(emptyResult);

    expect(publisher.publishBatch).toHaveBeenCalledOnce();
  });

  it("propagates publisher initialisation errors", async () => {
    const error = new Error("Publisher initialisation failed.");

    const dependencies = createDependencies({
      getPublisher: vi.fn(async () => {
        throw error;
      }),
    });

    const handler = createOutboxLambdaHandler(dependencies);

    await expect(handler()).rejects.toBe(error);
  });

  it("propagates batch processing errors", async () => {
    const error = new Error("Outbox batch processing failed.");

    const publisher = {
      publishBatch: vi.fn(async () => {
        throw error;
      }),
    } as unknown as OutboxPublisher;

    const dependencies = createDependencies({
      getPublisher: vi.fn(async () => publisher),
    });

    const handler = createOutboxLambdaHandler(dependencies);

    await expect(handler()).rejects.toBe(error);
  });
});
