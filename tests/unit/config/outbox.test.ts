import { afterEach, describe, expect, it, vi } from "vitest";

async function loadOutboxConfig() {
  vi.resetModules();

  return import("#config/outbox.js");
}

function stubValidEnvironment(): void {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("EMAIL_FROM_ADDRESS", "onboarding@example.com");
  vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("outbox configuration", () => {
  it("loads required configuration and applies publisher defaults", async () => {
    stubValidEnvironment();

    const { outboxConfig } = await loadOutboxConfig();

    expect(outboxConfig).toEqual({
      nodeEnv: "development",
      emailFromAddress: "onboarding@example.com",
      publicAppUrl: "http://localhost:3000",
      batchSize: 25,
      leaseDurationMs: 60_000,
      maxAttempts: 10,
      retryBaseDelayMs: 1_000,
      retryMaxDelayMs: 900_000,
    });
  });

  it("accepts explicitly configured publisher settings", async () => {
    stubValidEnvironment();

    vi.stubEnv("OUTBOX_BATCH_SIZE", "50");
    vi.stubEnv("OUTBOX_LEASE_DURATION_MS", "120000");
    vi.stubEnv("OUTBOX_MAX_ATTEMPTS", "8");
    vi.stubEnv("OUTBOX_RETRY_BASE_DELAY_MS", "2000");
    vi.stubEnv("OUTBOX_RETRY_MAX_DELAY_MS", "600000");

    const { outboxConfig } = await loadOutboxConfig();

    expect(outboxConfig.batchSize).toBe(50);
    expect(outboxConfig.leaseDurationMs).toBe(120_000);
    expect(outboxConfig.maxAttempts).toBe(8);
    expect(outboxConfig.retryBaseDelayMs).toBe(2_000);
    expect(outboxConfig.retryMaxDelayMs).toBe(600_000);
  });

  it("rejects a missing sender address", async () => {
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");

    await expect(loadOutboxConfig()).rejects.toThrow();
  });

  it("rejects an invalid sender email address", async () => {
    stubValidEnvironment();
    vi.stubEnv("EMAIL_FROM_ADDRESS", "not-an-email");

    await expect(loadOutboxConfig()).rejects.toThrow();
  });

  it("rejects an invalid public application URL", async () => {
    stubValidEnvironment();
    vi.stubEnv("PUBLIC_APP_URL", "not-a-url");

    await expect(loadOutboxConfig()).rejects.toThrow();
  });

  it("rejects HTTP URLs in production", async () => {
    stubValidEnvironment();
    vi.stubEnv("NODE_ENV", "production");

    await expect(loadOutboxConfig()).rejects.toThrow(
      "PUBLIC_APP_URL must use HTTPS in production.",
    );
  });

  it("accepts HTTPS URLs in production", async () => {
    stubValidEnvironment();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://app.example.com");

    const { outboxConfig } = await loadOutboxConfig();

    expect(outboxConfig.publicAppUrl).toBe("https://app.example.com");
  });

  it("rejects URLs containing credentials", async () => {
    stubValidEnvironment();
    vi.stubEnv("PUBLIC_APP_URL", "https://user:password@example.com");

    await expect(loadOutboxConfig()).rejects.toThrow(
      "PUBLIC_APP_URL must not contain credentials.",
    );
  });

  it("rejects URLs containing query parameters", async () => {
    stubValidEnvironment();
    vi.stubEnv("PUBLIC_APP_URL", "https://app.example.com?source=test");

    await expect(loadOutboxConfig()).rejects.toThrow(
      "PUBLIC_APP_URL must not contain a query or fragment.",
    );
  });

  it("rejects URLs containing fragments", async () => {
    stubValidEnvironment();
    vi.stubEnv("PUBLIC_APP_URL", "https://app.example.com#verification");

    await expect(loadOutboxConfig()).rejects.toThrow(
      "PUBLIC_APP_URL must not contain a query or fragment.",
    );
  });

  it("rejects invalid publisher settings", async () => {
    stubValidEnvironment();
    vi.stubEnv("OUTBOX_BATCH_SIZE", "0");

    await expect(loadOutboxConfig()).rejects.toThrow();
  });

  it("rejects a retry maximum lower than the base delay", async () => {
    stubValidEnvironment();
    vi.stubEnv("OUTBOX_RETRY_BASE_DELAY_MS", "5000");
    vi.stubEnv("OUTBOX_RETRY_MAX_DELAY_MS", "1000");

    await expect(loadOutboxConfig()).rejects.toThrow(
      "OUTBOX_RETRY_MAX_DELAY_MS must be greater than or equal to OUTBOX_RETRY_BASE_DELAY_MS.",
    );
  });
});
