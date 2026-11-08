import { z } from "zod";

import { UnsupportedOutboxEventError } from "#modules/outbox/application/unsupported-outbox-event.error.js";

import type { OutboxEventDispatcher } from "#modules/outbox/application/ports/outbox-event-dispatcher.js";
import type { OutboxEventHandler } from "#modules/outbox/application/ports/outbox-event-handler.js";
import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

const handlerRegistrySchema = z
  .array(z.string().min(1))
  .refine((eventTypes) => new Set(eventTypes).size === eventTypes.length, {
    message: "Outbox event handler registrations must be unique.",
  });

export class RoutingOutboxEventDispatcher implements OutboxEventDispatcher {
  constructor(
    private readonly handlers: ReadonlyMap<string, OutboxEventHandler>,
  ) {
    handlerRegistrySchema.parse([...handlers.keys()]);
  }

  async dispatch(event: ClaimedOutboxEvent): Promise<void> {
    const handler = this.handlers.get(event.eventType);

    if (!handler) {
      throw new UnsupportedOutboxEventError(event.eventType);
    }

    await handler.handle(event);
  }
}
