import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import serverless from "serverless-http";

import { app } from "#bootstrap/http.js";
import { env } from "#config/env.js";
import {
  DynamoDbRegistrationRateLimiter,
  type RegistrationRateLimiter,
} from "#infrastructure/rate-limiting/dynamodb-registration-rate-limiter.js";

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";

type LambdaProxyHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

interface LambdaHandlerDependencies {
  rateLimiter: RegistrationRateLimiter;
  proxyHandler: LambdaProxyHandler;
}

export function createLambdaHandler({
  rateLimiter,
  proxyHandler,
}: LambdaHandlerDependencies): LambdaProxyHandler {
  return async (event, context) => {
    if (event.routeKey !== "POST /identity/register") {
      return proxyHandler(event, context);
    }

    const ipAddress = event.requestContext.http.sourceIp;

    if (!ipAddress) {
      return {
        statusCode: 503,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
        body: JSON.stringify({
          error: "RATE_LIMIT_UNAVAILABLE",
          message: "Registration is temporarily unavailable.",
        }),
      };
    }

    try {
      const decision = await rateLimiter.consume(ipAddress);

      if (!decision.allowed) {
        return {
          statusCode: 429,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "retry-after": String(decision.retryAfterSeconds),
          },
          body: JSON.stringify({
            error: "RATE_LIMIT_EXCEEDED",
            message: "Too many registration attempts. Please try again later.",
          }),
        };
      }
    } catch (error) {
      console.error(
        "Registration rate limiter failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return {
        statusCode: 503,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
        body: JSON.stringify({
          error: "RATE_LIMIT_UNAVAILABLE",
          message: "Registration is temporarily unavailable.",
        }),
      };
    }

    return proxyHandler(event, context);
  };
}

let lambdaHandler: LambdaProxyHandler | undefined;

function getLambdaHandler(): LambdaProxyHandler {
  if (lambdaHandler) {
    return lambdaHandler;
  }

  if (!env.registrationRateLimitTableName) {
    throw new Error("REGISTRATION_RATE_LIMIT_TABLE_NAME is required.");
  }

  const dynamodb = new DynamoDBClient({
    region: env.awsRegion,
  });

  const rateLimiter = new DynamoDbRegistrationRateLimiter({
    client: dynamodb,
    tableName: env.registrationRateLimitTableName,
    maxAttempts: env.registrationRateLimitMaxAttempts,
    windowSeconds: env.registrationRateLimitWindowSeconds,
  });

  const proxyHandler = serverless(app) as unknown as LambdaProxyHandler;

  lambdaHandler = createLambdaHandler({
    rateLimiter,
    proxyHandler,
  });

  return lambdaHandler;
}

export const handler: LambdaProxyHandler = (event, context) =>
  getLambdaHandler()(event, context);
