import { outboxEvents } from "../../schema/identity.schema.js";
import type { DatabaseExecutor } from "../../client.js";
import { UserRegistered } from "../../../../modules/identity/domain/user-registered.event.js";

export class DrizzleOutboxRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async append(event: UserRegistered): Promise<void> {
    await this.db.insert(outboxEvents).values({
      id: event.id,
      aggregateType: "user",
      aggregateId: event.userId,
      eventType: event.type,
      payload: {
        userId: event.userId,
        occurredAt: event.occurredAt,
      },
      occurredAt: new Date(event.occurredAt),
    });
  }
}
