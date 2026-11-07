import {
  UpdateItemCommand,
  type DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RegistrationRateLimiter {
  consume(ipAddress: string): Promise<RateLimitDecision>;
}

interface DynamoDbRegistrationRateLimiterOptions {
  client: DynamoDBClient;
  tableName: string;
  maxAttempts: number;
  windowSeconds: number;
  now?: () => number;
}

export class DynamoDbRegistrationRateLimiter implements RegistrationRateLimiter {
  private readonly now: () => number;

  constructor(
    private readonly options: DynamoDbRegistrationRateLimiterOptions,
  ) {
    if (!options.tableName.trim()) {
      throw new Error("Rate limit table name is required.");
    }

    if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
      throw new Error("Rate limit max attempts must be a positive integer.");
    }

    if (!Number.isInteger(options.windowSeconds) || options.windowSeconds < 1) {
      throw new Error("Rate limit window must be a positive integer.");
    }

    this.now = options.now ?? Date.now;
  }

  async consume(ipAddress: string): Promise<RateLimitDecision> {
    const now = this.now();
    const windowMilliseconds = this.options.windowSeconds * 1000;
    const windowStartMilliseconds =
      Math.floor(now / windowMilliseconds) * windowMilliseconds;

    const windowStartSeconds = Math.floor(windowStartMilliseconds / 1000);

    const expiresAt = windowStartSeconds + this.options.windowSeconds * 2;

    try {
      await this.options.client.send(
        new UpdateItemCommand({
          TableName: this.options.tableName,
          Key: {
            rate_limit_key: {
              S: `registration#${ipAddress}`,
            },
            window_start: {
              N: String(windowStartSeconds),
            },
          },
          UpdateExpression:
            "SET expires_at = if_not_exists(expires_at, :expiresAt) ADD request_count :one",
          ConditionExpression:
            "attribute_not_exists(request_count) OR request_count < :maxAttempts",
          ExpressionAttributeValues: {
            ":expiresAt": { N: String(expiresAt) },
            ":one": { N: "1" },
            ":maxAttempts": {
              N: String(this.options.maxAttempts),
            },
          },
        }),
      );

      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      ) {
        const windowEndsAt = windowStartMilliseconds + windowMilliseconds;

        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((windowEndsAt - now) / 1000),
          ),
        };
      }

      throw error;
    }
  }
}
