
import { z } from "zod";

const outboxEnvironmentSchema = z
  .strictObject({
    nodeEnv: z.string().default("development"),

    emailFromAddress: z.email(),

    publicAppUrl: z.url(),

    batchSize: z.coerce.number().int().positive().default(25),

    leaseDurationMs: z.coerce.number().int().positive().default(60_000),

    maxAttempts: z.coerce.number().int().positive().default(10),

    retryBaseDelayMs: z.coerce.number().int().positive().default(1_000),

    retryMaxDelayMs: z.coerce.number().int().positive().default(900_000),
  })
  .superRefine((config, context) => {
    const publicUrl = new URL(config.publicAppUrl);

    if (publicUrl.username || publicUrl.password) {
      context.addIssue({
        code: "custom",
        path: ["publicAppUrl"],
        message: "PUBLIC_APP_URL must not contain credentials.",
      });
    }

    if (publicUrl.search || publicUrl.hash) {
      context.addIssue({
        code: "custom",
        path: ["publicAppUrl"],
        message: "PUBLIC_APP_URL must not contain a query or fragment.",
      });
    }

    if (
      config.nodeEnv === "production" &&
      publicUrl.protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["publicAppUrl"],
        message: "PUBLIC_APP_URL must use HTTPS in production.",
      });
    }

    if (config.retryMaxDelayMs < config.retryBaseDelayMs) {
      context.addIssue({
        code: "custom",
        path: ["retryMaxDelayMs"],
        message:
          "OUTBOX_RETRY_MAX_DELAY_MS must be greater than or equal to OUTBOX_RETRY_BASE_DELAY_MS.",
      });
    }
  });

export type OutboxConfig = z.infer<typeof outboxEnvironmentSchema>;

export const outboxConfig: OutboxConfig = outboxEnvironmentSchema.parse({
  nodeEnv: process.env.NODE_ENV ?? "development",

  emailFromAddress: process.env.EMAIL_FROM_ADDRESS,

  publicAppUrl: process.env.PUBLIC_APP_URL,

  batchSize: process.env.OUTBOX_BATCH_SIZE,

  leaseDurationMs: process.env.OUTBOX_LEASE_DURATION_MS,

  maxAttempts: process.env.OUTBOX_MAX_ATTEMPTS,

  retryBaseDelayMs: process.env.OUTBOX_RETRY_BASE_DELAY_MS,

  retryMaxDelayMs: process.env.OUTBOX_RETRY_MAX_DELAY_MS,
});
