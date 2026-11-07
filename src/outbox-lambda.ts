import type {
  OutboxPublishResult,
  OutboxPublisher,
} from "#modules/outbox/application/outbox-publisher.js";

export interface OutboxLambdaDependencies {
  getPublisher: () => Promise<OutboxPublisher>;
}

export function createOutboxLambdaHandler({
  getPublisher,
}: OutboxLambdaDependencies): () => Promise<OutboxPublishResult> {
  return async () => {
    const publisher = await getPublisher();
    const result = await publisher.publishBatch();

    console.info("Outbox batch processed.", result);

    return result;
  };
}

export const handler = createOutboxLambdaHandler({
  getPublisher: async () => {
    const { getOutboxPublisher } = await import("#bootstrap/outbox.js");

    return getOutboxPublisher();
  },
});
