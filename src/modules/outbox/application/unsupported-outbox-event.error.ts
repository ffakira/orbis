export class UnsupportedOutboxEventError extends Error {
  constructor(eventType: string) {
    super(`No handler registered for outbox event type: ${eventType}`);

    this.name = "UnsupportedOutboxEventError";
  }
}
