import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

export interface OutboxEventHandler {
  handle(event: ClaimedOutboxEvent): Promise<void>;
}
