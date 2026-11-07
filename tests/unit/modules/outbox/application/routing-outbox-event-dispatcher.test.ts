
import { describe, expect, it, vi } from "vitest";

import { RoutingOutboxEventDispatcher } from "#modules/outbox/application/routing-outbox-event-dispatcher.js";
import { UnsupportedOutboxEventError } from "#modules/outbox/application/unsupported-outbox-event.error.js";

import type { OutboxEventHandler } from "#modules/outbox/application/ports/outbox-event-handler.js";
import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

const event: ClaimedOutboxEvent = {
  id: "event-123",
  eventType: "identity.email_verification_requested.v1",
  payload: {
    userId: "user-123",
    tokenId: "token-123",
    expiresAt: "2026-11-08T12:00:00.000Z",
    occurredAt: "2026-11-07T12:00:00.000Z",
  },
  attempts: 1,
  leaseToken: "lease-token-123",
};

describe("RoutingOutboxEventDispatcher", () => {
  it("dispatches an event to its registered handler", async () => {
    const handler: OutboxEventHandler = {
      handle: vi.fn(async () => {}),
    };

    const dispatcher = new RoutingOutboxEventDispatcher(
      new Map([
        ["identity.email_verification_requested.v1", handler],
      ]),
    );

    await dispatcher.dispatch(event);

    expect(handler.handle).toHaveBeenCalledOnce();
    expect(handler.handle).toHaveBeenCalledWith(event);
  });

  it("throws when no handler is registered for the event type", async () => {
    const dispatcher = new RoutingOutboxEventDispatcher(
      new Map(),
    );

    await expect(
      dispatcher.dispatch(event),
    ).rejects.toThrow(
      new UnsupportedOutboxEventError(event.eventType),
    );
  });

  it("propagates errors thrown by the registered handler", async () => {
    const handlerError = new Error("Email delivery failed.");

    const handler: OutboxEventHandler = {
      handle: vi.fn(async () => {
        throw handlerError;
      }),
    };

    const dispatcher = new RoutingOutboxEventDispatcher(
      new Map([
        ["identity.email_verification_requested.v1", handler],
      ]),
    );

    await expect(
      dispatcher.dispatch(event),
    ).rejects.toBe(handlerError);
  });

  it("does not invoke handlers registered for another event type", async () => {
    const handler: OutboxEventHandler = {
      handle: vi.fn(async () => {}),
    };

    const dispatcher = new RoutingOutboxEventDispatcher(
      new Map([
        ["identity.user_registered.v1", handler],
      ]),
    );

    await expect(
      dispatcher.dispatch(event),
    ).rejects.toThrow(UnsupportedOutboxEventError);

    expect(handler.handle).not.toHaveBeenCalled();
  });
});
