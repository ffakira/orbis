import { describe, expect, it, vi } from "vitest";

import type {
  APIGatewayProxyEventV2,
  Context,
} from "aws-lambda";

import { createLambdaHandler } from "../../../src/lambda.js";

import type {
  RegistrationRateLimiter,
} from "../../../src/infrastructure/rate-limiting/dynamodb-registration-rate-limiter.js";

function createEvent(
  routeKey = "POST /identity/register",
  sourceIp = "192.0.2.10",
): APIGatewayProxyEventV2 {
  return {
    routeKey,
    requestContext: {
      http: {
        sourceIp,
      },
    },
  } as APIGatewayProxyEventV2;
}

const context = {} as Context;

describe("Lambda registration rate limiting", () => {
  it("returns 429 when the IP has exceeded its limit", async () => {
    const rateLimiter: RegistrationRateLimiter = {
      consume: vi.fn().mockResolvedValue({
        allowed: false,
        retryAfterSeconds: 420,
      }),
    };

    const proxyHandler = vi.fn();

    const handler = createLambdaHandler({
      rateLimiter,
      proxyHandler,
    });

    const response = await handler(createEvent(), context);

    expect(response.statusCode).toBe(429);
    expect(response.headers).toMatchObject({
      "retry-after": "420",
    });

    expect(JSON.parse(response.body as string)).toEqual({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Too many registration attempts. Please try again later.",
    });

    expect(rateLimiter.consume).toHaveBeenCalledWith("192.0.2.10");
    expect(proxyHandler).not.toHaveBeenCalled();
  });

  it("forwards registration when the IP is within its limit", async () => {
    const rateLimiter: RegistrationRateLimiter = {
      consume: vi.fn().mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
      }),
    };

    const proxyHandler = vi.fn().mockResolvedValue({
      statusCode: 201,
      body: JSON.stringify({ userId: "synthetic-user-id" }),
    });

    const handler = createLambdaHandler({
      rateLimiter,
      proxyHandler,
    });

    const event = createEvent();
    const response = await handler(event, context);

    expect(response.statusCode).toBe(201);
    expect(rateLimiter.consume).toHaveBeenCalledWith("192.0.2.10");
    expect(proxyHandler).toHaveBeenCalledWith(event, context);
  });

  it("does not rate-limit unrelated routes", async () => {
    const rateLimiter: RegistrationRateLimiter = {
      consume: vi.fn(),
    };

    const proxyHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: "ok",
    });

    const handler = createLambdaHandler({
      rateLimiter,
      proxyHandler,
    });

    const event = createEvent("GET /health");
    const response = await handler(event, context);

    expect(response.statusCode).toBe(200);
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(proxyHandler).toHaveBeenCalledOnce();
  });

  it("fails closed when DynamoDB is unavailable", async () => {
    const rateLimiter: RegistrationRateLimiter = {
      consume: vi.fn().mockRejectedValue(
        new Error("Synthetic DynamoDB failure"),
      ),
    };

    const proxyHandler = vi.fn();

    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const handler = createLambdaHandler({
        rateLimiter,
        proxyHandler,
      });

      const response = await handler(createEvent(), context);

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body as string)).toEqual({
        error: "RATE_LIMIT_UNAVAILABLE",
        message: "Registration is temporarily unavailable.",
      });

      expect(proxyHandler).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("fails closed when API Gateway does not provide a source IP", async () => {
    const rateLimiter: RegistrationRateLimiter = {
      consume: vi.fn(),
    };

    const proxyHandler = vi.fn();

    const handler = createLambdaHandler({
      rateLimiter,
      proxyHandler,
    });

    const event = {
      routeKey: "POST /identity/register",
      requestContext: {
        http: {},
      },
    } as APIGatewayProxyEventV2;

    const response = await handler(event, context);

    expect(response.statusCode).toBe(503);
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(proxyHandler).not.toHaveBeenCalled();
  });
});
