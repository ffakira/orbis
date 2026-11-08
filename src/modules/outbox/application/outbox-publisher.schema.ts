import { z } from "zod";

export const outboxPublisherConfigSchema = z
  .strictObject({
    batchSize: z.number().int().positive(),
    leaseDurationMs: z.number().positive(),
    maxAttempts: z.number().int().positive(),
    retryBaseDelayMs: z.number().positive(),
    retryMaxDelayMs: z.number().positive(),
  })
  .refine((config) => config.retryMaxDelayMs >= config.retryBaseDelayMs, {
    message:
      "Retry maximum delay must be greater than or equal to the base delay.",
    path: ["retryMaxDelayMs"],
  });

export type OutboxPublisherConfig = z.infer<typeof outboxPublisherConfigSchema>;
