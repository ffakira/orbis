import {
  outboxPublisherConfigSchema,
  type OutboxPublisherConfig,
} from "#modules/outbox/application/outbox-publisher.schema.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { OutboxEventDispatcher } from "#modules/outbox/application/ports/outbox-event-dispatcher.js";
import type {
  ClaimedOutboxEvent,
  OutboxRepository,
} from "#modules/outbox/application/ports/outbox-repository.js";

export interface OutboxPublisherDependencies {
  clock: Clock;
  dispatcher: OutboxEventDispatcher;
  repository: OutboxRepository;
  config: OutboxPublisherConfig;
}

export interface OutboxPublishResult {
  claimed: number;
  published: number;
  failed: number;
  deadLettered: number;
  leaseLost: number;
}

export class OutboxPublisher {
  private readonly config: OutboxPublisherConfig;

  constructor(private readonly dependencies: OutboxPublisherDependencies) {
    this.config = outboxPublisherConfigSchema.parse(dependencies.config);
  }

  async publishBatch(): Promise<OutboxPublishResult> {
    const { clock, repository } = this.dependencies;

    const events = await repository.claimBatch({
      now: clock.now(),
      limit: this.config.batchSize,
      leaseDurationMs: this.config.leaseDurationMs,
    });

    const result: OutboxPublishResult = {
      claimed: events.length,
      published: 0,
      failed: 0,
      deadLettered: 0,
      leaseLost: 0,
    };

    for (const event of events) {
      await this.publishEvent(event, result);
    }

    return result;
  }

  private async publishEvent(
    event: ClaimedOutboxEvent,
    result: OutboxPublishResult,
  ): Promise<void> {
    const { clock, dispatcher, repository } = this.dependencies;

    let dispatchFailed = false;
    let dispatchError: unknown;

    try {
      await dispatcher.dispatch(event);
    } catch (error: unknown) {
      dispatchFailed = true;
      dispatchError = error;
    }

    if (!dispatchFailed) {
      const acknowledged = await repository.markPublished({
        eventId: event.id,
        leaseToken: event.leaseToken,
        publishedAt: clock.now(),
      });

      if (acknowledged) {
        result.published++;
      } else {
        result.leaseLost++;
      }

      return;
    }

    const failedAt = clock.now();

    const failure = await repository.markFailed({
      eventId: event.id,
      leaseToken: event.leaseToken,
      failedAt,
      nextAvailableAt: new Date(
        failedAt.getTime() + this.calculateRetryDelay(event.attempts),
      ),
      error: this.getErrorMessage(dispatchError),
      maxAttempts: this.config.maxAttempts,
    });

    if (failure === "retry_scheduled") {
      result.failed++;
    } else if (failure === "dead_lettered") {
      result.deadLettered++;
    } else {
      result.leaseLost++;
    }
  }

  private calculateRetryDelay(attempts: number): number {
    const exponentialDelay =
      this.config.retryBaseDelayMs * 2 ** Math.max(0, attempts - 1);

    return Math.min(exponentialDelay, this.config.retryMaxDelayMs);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
