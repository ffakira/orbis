import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DynamoDbRegistrationRateLimiter } from "../../../src/infrastructure/rate-limiting/dynamodb-registration-rate-limiter.js";

import type { RegistrationRateLimiter } from "../../../src/infrastructure/rate-limiting/dynamodb-registration-rate-limiter.js";

const TABLE_NAME = "synthetic-registration-rate-limits";
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900;
const WINDOW_MILLISECONDS = WINDOW_SECONDS * 1000;

const INITIAL_TIME = Date.UTC(2026, 10, 7, 10, 7, 30);

function createClient() {
  const send = vi.fn().mockResolvedValue({});

  return {
    client: { send } as unknown as DynamoDBClient,
    send,
  };
}

function createLimiter(
  client: DynamoDBClient,
  options: {
    now?: () => number;
    maxAttempts?: number;
    windowSeconds?: number;
  } = {},
): RegistrationRateLimiter {
  return new DynamoDbRegistrationRateLimiter({
    client,
    tableName: TABLE_NAME,
    maxAttempts: options.maxAttempts ?? MAX_ATTEMPTS,
    windowSeconds: options.windowSeconds ?? WINDOW_SECONDS,
    now: options.now ?? (() => INITIAL_TIME),
  });
}

function createConditionalCheckFailure(): Error {
  return Object.assign(new Error("Conditional check failed"), {
    name: "ConditionalCheckFailedException",
  });
}

describe("DynamoDbRegistrationRateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("consume", () => {
    it("allows a request and executes an atomic DynamoDB update", async () => {
      const { client, send } = createClient();

      const limiter = createLimiter(client);

      const result = await limiter.consume("192.0.2.10");

      const windowStartMilliseconds =
        Math.floor(INITIAL_TIME / WINDOW_MILLISECONDS) * WINDOW_MILLISECONDS;

      const windowStartSeconds = Math.floor(windowStartMilliseconds / 1000);

      const expiresAt = windowStartSeconds + WINDOW_SECONDS * 2;

      expect(result).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });

      expect(send).toHaveBeenCalledOnce();

      const command = send.mock.calls[0]?.[0] as UpdateItemCommand | undefined;

      expect(command).toBeInstanceOf(UpdateItemCommand);

      expect(command?.input).toMatchObject({
        TableName: TABLE_NAME,

        Key: {
          rate_limit_key: {
            S: "registration#192.0.2.10",
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
          ":expiresAt": {
            N: String(expiresAt),
          },
          ":one": {
            N: "1",
          },
          ":maxAttempts": {
            N: String(MAX_ATTEMPTS),
          },
        },
      });
    });

    it("allows requests when DynamoDB updates successfully", async () => {
      const { client, send } = createClient();

      const limiter = createLimiter(client);

      const results = await Promise.all([
        limiter.consume("192.0.2.10"),
        limiter.consume("192.0.2.10"),
        limiter.consume("192.0.2.10"),
      ]);

      expect(results).toEqual([
        { allowed: true, retryAfterSeconds: 0 },
        { allowed: true, retryAfterSeconds: 0 },
        { allowed: true, retryAfterSeconds: 0 },
      ]);

      expect(send).toHaveBeenCalledTimes(3);
    });

    it("denies a request when the DynamoDB condition fails", async () => {
      const { client, send } = createClient();

      send.mockRejectedValueOnce(createConditionalCheckFailure());

      const limiter = createLimiter(client);

      const now = INITIAL_TIME;
      const windowStart =
        Math.floor(now / WINDOW_MILLISECONDS) * WINDOW_MILLISECONDS;

      const windowEndsAt = windowStart + WINDOW_MILLISECONDS;

      const expectedRetryAfter = Math.max(
        1,
        Math.ceil((windowEndsAt - now) / 1000),
      );

      const result = await limiter.consume("192.0.2.10");

      expect(result).toEqual({
        allowed: false,
        retryAfterSeconds: expectedRetryAfter,
      });

      expect(send).toHaveBeenCalledOnce();
    });

    it("returns at least one second when the window is about to expire", async () => {
      const { client, send } = createClient();

      send.mockRejectedValueOnce(createConditionalCheckFailure());

      const now = Date.UTC(2026, 10, 7, 10, 14, 59) + 500;

      const limiter = createLimiter(client, {
        now: () => now,
      });

      const result = await limiter.consume("192.0.2.10");

      expect(result).toEqual({
        allowed: false,
        retryAfterSeconds: 1,
      });
    });

    it("uses a different DynamoDB partition key for each time window", async () => {
      const { client, send } = createClient();

      let now = Date.UTC(2026, 10, 7, 10, 0, 0);

      const limiter = createLimiter(client, {
        now: () => now,
      });

      await limiter.consume("192.0.2.10");

      now += WINDOW_MILLISECONDS;

      await limiter.consume("192.0.2.10");

      expect(send).toHaveBeenCalledTimes(2);

      const firstCommand = send.mock.calls[0]?.[0] as
        UpdateItemCommand | undefined;

      const secondCommand = send.mock.calls[1]?.[0] as
        UpdateItemCommand | undefined;

      expect(firstCommand?.input.Key?.rate_limit_key).toEqual(
        secondCommand?.input.Key?.rate_limit_key,
      );

      expect(firstCommand?.input.Key?.window_start).not.toEqual(
        secondCommand?.input.Key?.window_start,
      );
    });

    it("propagates unexpected DynamoDB errors", async () => {
      const { client, send } = createClient();

      const databaseError = new Error("Synthetic DynamoDB unavailable");

      send.mockRejectedValueOnce(databaseError);

      const limiter = createLimiter(client);

      await expect(limiter.consume("192.0.2.10")).rejects.toBe(databaseError);
    });
  });

  describe("constructor", () => {
    it("rejects an empty table name", () => {
      const { client } = createClient();

      expect(
        () =>
          new DynamoDbRegistrationRateLimiter({
            client,
            tableName: " ",
            maxAttempts: MAX_ATTEMPTS,
            windowSeconds: WINDOW_SECONDS,
          }),
      ).toThrow("Rate limit table name is required.");
    });

    it("rejects a non-positive or non-integer maximum", () => {
      const { client } = createClient();

      for (const maxAttempts of [0, -1, 1.5]) {
        expect(
          () =>
            new DynamoDbRegistrationRateLimiter({
              client,
              tableName: TABLE_NAME,
              maxAttempts,
              windowSeconds: WINDOW_SECONDS,
            }),
        ).toThrow("Rate limit max attempts must be a positive integer.");
      }
    });

    it("rejects a non-positive or non-integer window", () => {
      const { client } = createClient();

      for (const windowSeconds of [0, -1, 1.5]) {
        expect(
          () =>
            new DynamoDbRegistrationRateLimiter({
              client,
              tableName: TABLE_NAME,
              maxAttempts: MAX_ATTEMPTS,
              windowSeconds,
            }),
        ).toThrow("Rate limit window must be a positive integer.");
      }
    });
  });
});
