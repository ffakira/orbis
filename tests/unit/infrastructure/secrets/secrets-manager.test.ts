import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validBase64Secret = Buffer.from(
  "synthetic-secret-with-at-least-32-random-bytes",
  "utf8",
).toString("base64");

const validApplicationSecret = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/test",
  JWT_SECRET: validBase64Secret,
  EMAIL_VERIFICATION_SECRET: validBase64Secret,
  RESEND_API_KEY: "re_test_synthetic_api_key",
};

async function loadSecretsManager() {
  return import("#infrastructure/secrets/secrets-manager.js");
}

function configureLocalEnvironment(overrides: Record<string, string> = {}) {
  vi.stubEnv("APPLICATION_SECRET_ARN", "");

  vi.stubEnv("DATABASE_URL", validApplicationSecret.DATABASE_URL);
  vi.stubEnv("JWT_SECRET", validApplicationSecret.JWT_SECRET);
  vi.stubEnv(
    "EMAIL_VERIFICATION_SECRET",
    validApplicationSecret.EMAIL_VERIFICATION_SECRET,
  );
  vi.stubEnv("RESEND_API_KEY", validApplicationSecret.RESEND_API_KEY);

  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
}

function mockSecretsExtension(secretString: string, status = 200) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify(
          status >= 200 && status < 300
            ? { SecretString: secretString }
            : { message: "Extension error" },
        ),
        { status },
      ),
    );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("Secrets Manager application secret", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads all credentials from local environment configuration", async () => {
    configureLocalEnvironment();

    const {
      getDatabaseSecret,
      getAuthenticationSecret,
      getEmailVerificationSecret,
      getResendSecret,
    } = await loadSecretsManager();

    const [database, authentication, emailVerification, resend] =
      await Promise.all([
        getDatabaseSecret(),
        getAuthenticationSecret(),
        getEmailVerificationSecret(),
        getResendSecret(),
      ]);

    expect(database.DATABASE_URL).toBe(validApplicationSecret.DATABASE_URL);

    expect(Buffer.from(authentication.JWT_SECRET).toString("base64")).toBe(
      validBase64Secret,
    );

    expect(
      Buffer.from(emailVerification.EMAIL_VERIFICATION_SECRET).toString(
        "base64",
      ),
    ).toBe(validBase64Secret);

    expect(resend.RESEND_API_KEY).toBe(validApplicationSecret.RESEND_API_KEY);
  });

  it("retrieves the consolidated secret through the Lambda extension", async () => {
    const secretArn =
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:application";

    vi.stubEnv("APPLICATION_SECRET_ARN", secretArn);
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    const fetchMock = mockSecretsExtension(
      JSON.stringify(validApplicationSecret),
    );

    const {
      getDatabaseSecret,
      getAuthenticationSecret,
      getEmailVerificationSecret,
      getResendSecret,
    } = await loadSecretsManager();

    const [database, authentication, emailVerification, resend] =
      await Promise.all([
        getDatabaseSecret(),
        getAuthenticationSecret(),
        getEmailVerificationSecret(),
        getResendSecret(),
      ]);

    expect(database.DATABASE_URL).toBe(validApplicationSecret.DATABASE_URL);

    expect(Buffer.from(authentication.JWT_SECRET).toString("base64")).toBe(
      validBase64Secret,
    );

    expect(
      Buffer.from(emailVerification.EMAIL_VERIFICATION_SECRET).toString(
        "base64",
      ),
    ).toBe(validBase64Secret);

    expect(resend.RESEND_API_KEY).toBe(validApplicationSecret.RESEND_API_KEY);

    expect(fetchMock).toHaveBeenCalledOnce();

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0]!;

    expect(String(requestUrl)).toContain(
      "secretId=" + encodeURIComponent(secretArn),
    );

    expect(requestOptions?.headers).toEqual({
      "X-Aws-Parameters-Secrets-Token": "test-session-token",
    });
  });

  it("rejects an invalid email verification Base64 value", async () => {
    configureLocalEnvironment({
      EMAIL_VERIFICATION_SECRET: "invalid-base64!",
    });

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "value must be Base64",
    );
  });

  it("rejects an email verification secret shorter than 32 bytes", async () => {
    configureLocalEnvironment({
      EMAIL_VERIFICATION_SECRET: Buffer.from("too-short").toString("base64"),
    });

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "at least 32 random bytes",
    );
  });

  it("rejects a consolidated secret missing a required property", async () => {
    const secretArn =
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:application";

    const incompleteSecret = {
      DATABASE_URL: validApplicationSecret.DATABASE_URL,
      JWT_SECRET: validApplicationSecret.JWT_SECRET,
      RESEND_API_KEY: validApplicationSecret.RESEND_API_KEY,
    };

    vi.stubEnv("APPLICATION_SECRET_ARN", secretArn);
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    mockSecretsExtension(JSON.stringify(incompleteSecret));

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "EMAIL_VERIFICATION_SECRET is missing or empty",
    );
  });

  it("rejects missing application secret configuration", async () => {
    configureLocalEnvironment({
      DATABASE_URL: "",
      JWT_SECRET: "",
      EMAIL_VERIFICATION_SECRET: "",
      RESEND_API_KEY: "",
    });

    const { getDatabaseSecret } = await loadSecretsManager();

    await expect(getDatabaseSecret()).rejects.toThrow(
      "APPLICATION_SECRET_ARN or all four application secret environment variables must be configured",
    );
  });

  it("rejects an invalid database URL", async () => {
    configureLocalEnvironment({
      DATABASE_URL: "https://invalid-database.example.com",
    });

    const { getDatabaseSecret } = await loadSecretsManager();

    await expect(getDatabaseSecret()).rejects.toThrow(
      "Invalid application secret: database URL protocol",
    );
  });
});
