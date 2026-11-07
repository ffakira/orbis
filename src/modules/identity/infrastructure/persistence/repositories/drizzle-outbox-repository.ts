import { DatabaseExecutor } from "../../../../../infrastructure/database/client.js";
import { outboxEvents } from "../../../../../infrastructure/database/schema/identity.schema.js";
import { UserRegistered } from "../../../domain/user-registered.event.js";

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
