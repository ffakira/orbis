import { randomUUID } from "node:crypto";

import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import { outboxEvents } from "#infrastructure/database/schema/identity.schema.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  ClaimOutboxEventsInput,
  ClaimedOutboxEvent,
  MarkOutboxEventFailedInput,
  MarkOutboxEventFailedResult,
  MarkOutboxEventPublishedInput,
  OutboxRepository,
} from "#modules/outbox/application/ports/outbox-repository.js";

export class DrizzleOutboxRepository implements OutboxRepository {
  constructor(private readonly db: Database) {}

  async claimBatch(
    input: ClaimOutboxEventsInput,
  ): Promise<ClaimedOutboxEvent[]> {
    if (!Number.isInteger(input.limit) || input.limit < 1) {
      throw new RangeError("Claim limit must be a positive integer.");
    }

    if (!Number.isFinite(input.leaseDurationMs) || input.leaseDurationMs <= 0) {
      throw new RangeError("Lease duration must be greater than zero.");
    }

    return this.db.transaction(async (tx) => {
      const candidates = await tx
        .select({ id: outboxEvents.id })
        .from(outboxEvents)
        .where(
          and(
            isNull(outboxEvents.publishedAt),
            isNull(outboxEvents.deadLetteredAt),
            lte(outboxEvents.availableAt, input.now),
            or(
              isNull(outboxEvents.leaseExpiresAt),
              lte(outboxEvents.leaseExpiresAt, input.now),
            ),
          ),
        )
        .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
        .limit(input.limit)
        .for("update", { skipLocked: true });

      const claimedEvents: ClaimedOutboxEvent[] = [];
      const leaseExpiresAt = new Date(
        input.now.getTime() + input.leaseDurationMs,
      );

      for (const candidate of candidates) {
        const leaseToken = randomUUID();

        const [claimedEvent] = await tx
          .update(outboxEvents)
          .set({
            leaseToken,
            leaseExpiresAt,
            attempts: sql`${outboxEvents.attempts} + 1`,
          })
          .where(eq(outboxEvents.id, candidate.id))
          .returning({
            id: outboxEvents.id,
            eventType: outboxEvents.eventType,
            payload: outboxEvents.payload,
            attempts: outboxEvents.attempts,
          });

        if (!claimedEvent) {
          continue;
        }

        claimedEvents.push({
          ...claimedEvent,
          leaseToken,
        });
      }

      return claimedEvents;
    });
  }

  async markPublished(input: MarkOutboxEventPublishedInput): Promise<boolean> {
    const [publishedEvent] = await this.db
      .update(outboxEvents)
      .set({
        publishedAt: input.publishedAt,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: null,
      })
      .where(
        and(
          eq(outboxEvents.id, input.eventId),
          eq(outboxEvents.leaseToken, input.leaseToken),
          isNull(outboxEvents.publishedAt),
          isNull(outboxEvents.deadLetteredAt),
        ),
      )
      .returning({ id: outboxEvents.id });

    return publishedEvent !== undefined;
  }

  async markFailed(
    input: MarkOutboxEventFailedInput,
  ): Promise<MarkOutboxEventFailedResult> {
    if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
      throw new RangeError("Maximum attempts must be a positive integer.");
    }

    const [failedEvent] = await this.db
      .update(outboxEvents)
      .set({
        availableAt: sql`
          CASE
            WHEN ${outboxEvents.attempts} >= ${input.maxAttempts}
              THEN ${outboxEvents.availableAt}
            ELSE ${input.nextAvailableAt}
          END
        `,
        deadLetteredAt: sql`
          CASE
            WHEN ${outboxEvents.attempts} >= ${input.maxAttempts}
              THEN ${input.failedAt}::timestamptz
            ELSE NULL::timestamptz
          END
        `,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: input.error,
      })
      .where(
        and(
          eq(outboxEvents.id, input.eventId),
          eq(outboxEvents.leaseToken, input.leaseToken),
          isNull(outboxEvents.publishedAt),
          isNull(outboxEvents.deadLetteredAt),
        ),
      )
      .returning({
        attempts: outboxEvents.attempts,
      });

    if (!failedEvent) {
      return "lease_lost";
    }

    return failedEvent.attempts >= input.maxAttempts
      ? "dead_lettered"
      : "retry_scheduled";
  }
}
