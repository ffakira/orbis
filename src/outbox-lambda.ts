import type {
  OutboxPublishResult,
  OutboxPublisher,
} from "#modules/outbox/application/outbox-publisher.js";

import { getOutboxPublisher } from "#bootstrap/outbox.js";

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

const outboxLambdaHandler = createOutboxLambdaHandler({
  getPublisher: getOutboxPublisher,
});

export const handler = outboxLambdaHandler;
