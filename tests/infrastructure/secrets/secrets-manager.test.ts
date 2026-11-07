import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validJwtSecret = Buffer.from(
  "0123456789abcdef0123456789abcdef0123456789abcdef",
).toString("base64");

async function loadSecretsManager() {
  return import("../../../src/infrastructure/secrets/secrets-manager.js");
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

describe("Secrets Manager authentication secret", () => {
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

  it("loads the authentication secret from local environment configuration", async () => {
    vi.stubEnv("AUTHENTICATION_SECRET_ARN", "");
    vi.stubEnv("JWT_SECRET", validJwtSecret);

    const { getAuthenticationSecret } = await loadSecretsManager();

    const result = await getAuthenticationSecret();

    expect(Buffer.from(result.JWT_SECRET).toString("base64")).toBe(
      validJwtSecret,
    );
  });

  it("retrieves and decodes the authentication secret through the Lambda extension", async () => {
    const secretArn =
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";

    vi.stubEnv("AUTHENTICATION_SECRET_ARN", secretArn);
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    const fetchMock = mockSecretsExtension(
      JSON.stringify({ JWT_SECRET: validJwtSecret }),
    );

    const { getAuthenticationSecret } = await loadSecretsManager();

    const result = await getAuthenticationSecret();

    expect(Buffer.from(result.JWT_SECRET).toString("base64")).toBe(
      validJwtSecret,
    );

    expect(fetchMock).toHaveBeenCalledOnce();

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0]!;

    expect(String(requestUrl)).toContain(
      "secretId=" + encodeURIComponent(secretArn),
    );

    expect(requestOptions?.headers).toEqual({
      "X-Aws-Parameters-Secrets-Token": "test-session-token",
    });
  });

  it("rejects an authentication secret with invalid Base64", async () => {
    vi.stubEnv("AUTHENTICATION_SECRET_ARN", "");
    vi.stubEnv("JWT_SECRET", "not-valid-base64!");

    const { getAuthenticationSecret } = await loadSecretsManager();

    await expect(getAuthenticationSecret()).rejects.toThrow(
      "JWT_SECRET must be Base64",
    );
  });

  it("rejects an authentication secret shorter than 32 bytes", async () => {
    vi.stubEnv("AUTHENTICATION_SECRET_ARN", "");
    vi.stubEnv("JWT_SECRET", Buffer.from("too-short").toString("base64"));

    const { getAuthenticationSecret } = await loadSecretsManager();

    await expect(getAuthenticationSecret()).rejects.toThrow(
      "at least 32 random bytes",
    );
  });

  it("rejects malformed authentication secret JSON", async () => {
    vi.stubEnv(
      "AUTHENTICATION_SECRET_ARN",
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
    );
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    mockSecretsExtension("{invalid-json");

    const { getAuthenticationSecret } = await loadSecretsManager();

    await expect(getAuthenticationSecret()).rejects.toThrow(
      "Authentication secret contains invalid JSON",
    );
  });

  it("rejects a failed Lambda extension request", async () => {
    vi.stubEnv(
      "AUTHENTICATION_SECRET_ARN",
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:test",
    );
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    mockSecretsExtension("", 500);

    const { getAuthenticationSecret } = await loadSecretsManager();

    await expect(getAuthenticationSecret()).rejects.toThrow(
      "Secrets Manager extension returned HTTP 500",
    );
  });

  it("rejects missing authentication configuration", async () => {
    vi.stubEnv("AUTHENTICATION_SECRET_ARN", "");
    vi.stubEnv("JWT_SECRET", "");

    const { getAuthenticationSecret } = await loadSecretsManager();

    await expect(getAuthenticationSecret()).rejects.toThrow(
      "Neither AUTHENTICATION_SECRET_ARN nor JWT_SECRET is configured",
    );
  });
});
