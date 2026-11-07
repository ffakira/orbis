import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import { outboxEvents } from "#infrastructure/database/schema/identity.schema.js";

import type { UserRegistered } from "#modules/identity/domain/user-registered.event.js";
import type { EmailVerificationRequested } from "#modules/identity/domain/email-verification-requested.event.js";

type IdentityOutboxEvent = UserRegistered | EmailVerificationRequested;

export class DrizzleOutboxRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async append(event: IdentityOutboxEvent): Promise<void> {
    const payload =
      event.type === "identity.user_registered.v1"
        ? {
            userId: event.userId,
            occurredAt: event.occurredAt,
          }
        : {
            userId: event.userId,
            tokenId: event.tokenId,
            expiresAt: event.expiresAt,
            occurredAt: event.occurredAt,
          };

    await this.db.insert(outboxEvents).values({
      id: event.id,
      aggregateType: "user",
      aggregateId: event.userId,
      eventType: event.type,
      payload,
      occurredAt: new Date(event.occurredAt),
    });
  }
}
