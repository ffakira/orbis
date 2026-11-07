import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  port: Number(process.env.PORT ?? 3000),

  logLevel: process.env.LOG_LEVEL ?? "info",

  awsRegion: process.env.AWS_REGION ?? "us-east-1",

  termsOfServiceVersion: process.env.TERMS_OF_SERVICE_VERSION,

  registrationRateLimitTableName:
    process.env.REGISTRATION_RATE_LIMIT_TABLE_NAME,

  registrationRateLimitMaxAttempts: Number(
    process.env.REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS ?? 5,
  ),

  registrationRateLimitWindowSeconds: Number(
    process.env.REGISTRATION_RATE_LIMIT_WINDOW_SECONDS ?? 900,
  ),
} as const;
