export interface OutboxEvent {
  id: string;
  userId: string;
  type: string;
  tokenId: string;
  expiresAt: string;
  occurredAt: string;
}
