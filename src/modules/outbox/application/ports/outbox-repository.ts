export interface ClaimedOutboxEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
  leaseToken: string;
}

export interface ClaimOutboxEventsInput {
  now: Date;
  limit: number;
  leaseDurationMs: number;
}

export interface MarkOutboxEventPublishedInput {
  eventId: string;
  leaseToken: string;
  publishedAt: Date;
}

export interface MarkOutboxEventFailedInput {
  eventId: string;
  leaseToken: string;
  failedAt: Date;
  nextAvailableAt: Date;
  error: string;
  maxAttempts: number;
}

export type MarkOutboxEventFailedResult =
  "retry_scheduled" | "dead_lettered" | "lease_lost";

export interface OutboxRepository {
  claimBatch(input: ClaimOutboxEventsInput): Promise<ClaimedOutboxEvent[]>;

  markPublished(input: MarkOutboxEventPublishedInput): Promise<boolean>;

  markFailed(
    input: MarkOutboxEventFailedInput,
  ): Promise<MarkOutboxEventFailedResult>;
}
