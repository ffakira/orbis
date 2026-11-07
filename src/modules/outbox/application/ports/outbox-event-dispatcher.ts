import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

export interface OutboxEventDispatcher {
  dispatch(event: ClaimedOutboxEvent): Promise<void>;
}
