import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validEmailVerificationSecret = Buffer.from(
  "synthetic-email-verification-secret-with-at-least-32-bytes",
  "utf8",
).toString("base64");

async function loadSecretsManager() {
  return import("#infrastructure/secrets/secrets-manager.js");
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

describe("Secrets Manager email verification secret", () => {
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

  it("loads the email verification secret from local environment configuration", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_SECRET_ARN", "");
    vi.stubEnv("EMAIL_VERIFICATION_SECRET", validEmailVerificationSecret);

    const { getEmailVerificationSecret } = await loadSecretsManager();

    const result = await getEmailVerificationSecret();

    expect(
      Buffer.from(result.EMAIL_VERIFICATION_SECRET).toString("base64"),
    ).toBe(validEmailVerificationSecret);
  });

  it("retrieves the email verification secret through the Lambda extension", async () => {
    const secretArn =
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:email-verification";

    vi.stubEnv("EMAIL_VERIFICATION_SECRET_ARN", secretArn);
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    const fetchMock = mockSecretsExtension(
      JSON.stringify({
        EMAIL_VERIFICATION_SECRET: validEmailVerificationSecret,
      }),
    );

    const { getEmailVerificationSecret } = await loadSecretsManager();

    const result = await getEmailVerificationSecret();

    expect(
      Buffer.from(result.EMAIL_VERIFICATION_SECRET).toString("base64"),
    ).toBe(validEmailVerificationSecret);

    expect(fetchMock).toHaveBeenCalledOnce();

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0]!;

    expect(String(requestUrl)).toContain(
      "secretId=" + encodeURIComponent(secretArn),
    );

    expect(requestOptions?.headers).toEqual({
      "X-Aws-Parameters-Secrets-Token": "test-session-token",
    });
  });

  it("rejects an email verification secret with invalid Base64", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_SECRET_ARN", "");
    vi.stubEnv("EMAIL_VERIFICATION_SECRET", "invalid-base64!");

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "value must be Base64",
    );
  });

  it("rejects an email verification secret shorter than 32 bytes", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_SECRET_ARN", "");
    vi.stubEnv(
      "EMAIL_VERIFICATION_SECRET",
      Buffer.from("too-short").toString("base64"),
    );

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "at least 32 random bytes",
    );
  });

  it("rejects a secret without EMAIL_VERIFICATION_SECRET", async () => {
    vi.stubEnv(
      "EMAIL_VERIFICATION_SECRET_ARN",
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:email-verification",
    );
    vi.stubEnv("AWS_SESSION_TOKEN", "test-session-token");

    mockSecretsExtension(JSON.stringify({ OTHER_SECRET: "value" }));

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "EMAIL_VERIFICATION_SECRET is missing",
    );
  });

  it("rejects missing email verification configuration", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_SECRET_ARN", "");
    vi.stubEnv("EMAIL_VERIFICATION_SECRET", "");

    const { getEmailVerificationSecret } = await loadSecretsManager();

    await expect(getEmailVerificationSecret()).rejects.toThrow(
      "Neither EMAIL_VERIFICATION_SECRET_ARN nor EMAIL_VERIFICATION_SECRET is configured",
    );
  });
});
