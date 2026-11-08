import { outboxEvents } from "#infrastructure/database/schema/identity.schema.js";

import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import type { EmailVerificationRequested } from "#modules/identity/domain/email-verification-requested.event.js";

export class DrizzleOutboxRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async append(event: EmailVerificationRequested): Promise<void> {
    await this.db.insert(outboxEvents).values({
      id: event.id,
      aggregateType: "user",
      aggregateId: event.userId,
      eventType: event.type,
      payload: {
        userId: event.userId,
        tokenId: event.tokenId,
        expiresAt: event.expiresAt,
        occurredAt: event.occurredAt,
      },
      occurredAt: new Date(event.occurredAt),
    });
  }
}
