import "#config/env.js";

import { Buffer } from "node:buffer";

interface ApplicationSecret {
  DATABASE_URL: string;
  JWT_SECRET: string;
  EMAIL_VERIFICATION_SECRET: string;
  RESEND_API_KEY: string;
}

interface DatabaseSecret {
  DATABASE_URL: string;
}

interface AuthenticationSecret {
  JWT_SECRET: Uint8Array;
}

interface EmailVerificationSecret {
  EMAIL_VERIFICATION_SECRET: Uint8Array;
}

interface ResendSecret {
  RESEND_API_KEY: string;
}

interface SecretsManagerResponse {
  SecretString?: string;
}

let applicationSecretPromise: Promise<ApplicationSecret> | undefined;

function parseSecretString(secretString: string): unknown {
  try {
    return JSON.parse(secretString);
  } catch {
    throw new Error("Application secret contains invalid JSON");
  }
}

async function retrieveSecretString(secretArn: string): Promise<string> {
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!sessionToken) {
    throw new Error("AWS_SESSION_TOKEN environment variable is missing");
  }

  const port = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? "2773";
  const url = new URL(`http://localhost:${port}/secretsmanager/get`);

  url.searchParams.set("secretId", secretArn);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Aws-Parameters-Secrets-Token": sessionToken,
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(
      `Secrets Manager extension returned HTTP ${response.status} while retrieving the application secret`,
    );
  }

  const result = (await response.json()) as SecretsManagerResponse;

  if (!result.SecretString) {
    throw new Error("Application secret has no SecretString");
  }

  return result.SecretString;
}

function decodeBase64Secret(
  encodedSecret: string,
  secretName: string,
): Uint8Array {
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedSecret) ||
    encodedSecret.length % 4 !== 0
  ) {
    throw new Error(`Invalid ${secretName} secret: value must be Base64`);
  }

  const decodedSecret = Buffer.from(encodedSecret, "base64");

  if (
    decodedSecret.length < 32 ||
    decodedSecret.toString("base64") !== encodedSecret
  ) {
    throw new Error(
      `Invalid ${secretName} secret: value must contain at least 32 random bytes`,
    );
  }

  return decodedSecret;
}

function validateApplicationSecret(value: unknown): ApplicationSecret {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid application secret: expected a JSON object");
  }

  const candidate = value as Record<string, unknown>;

  const requiredKeys = [
    "DATABASE_URL",
    "JWT_SECRET",
    "EMAIL_VERIFICATION_SECRET",
    "RESEND_API_KEY",
  ] as const;

  for (const key of requiredKeys) {
    if (typeof candidate[key] !== "string" || candidate[key].trim() === "") {
      throw new Error(`Invalid application secret: ${key} is missing or empty`);
    }
  }

  const databaseUrl = candidate.DATABASE_URL as string;
  const parsedDatabaseUrl = new URL(databaseUrl);

  if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
    throw new Error("Invalid application secret: database URL protocol");
  }

  return {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: candidate.JWT_SECRET as string,
    EMAIL_VERIFICATION_SECRET: candidate.EMAIL_VERIFICATION_SECRET as string,
    RESEND_API_KEY: candidate.RESEND_API_KEY as string,
  };
}

async function retrieveApplicationSecret(): Promise<ApplicationSecret> {
  const secretArn = process.env.APPLICATION_SECRET_ARN;

  if (!secretArn) {
    const databaseUrl = process.env.DATABASE_URL;
    const jwtSecret = process.env.JWT_SECRET;
    const emailVerificationSecret = process.env.EMAIL_VERIFICATION_SECRET;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (
      !databaseUrl ||
      !jwtSecret ||
      !emailVerificationSecret ||
      !resendApiKey
    ) {
      throw new Error(
        "APPLICATION_SECRET_ARN or all four application secret environment variables must be configured",
      );
    }

    return validateApplicationSecret({
      DATABASE_URL: databaseUrl,
      JWT_SECRET: jwtSecret,
      EMAIL_VERIFICATION_SECRET: emailVerificationSecret,
      RESEND_API_KEY: resendApiKey,
    });
  }

  const secretString = await retrieveSecretString(secretArn);

  return validateApplicationSecret(parseSecretString(secretString));
}

function getApplicationSecret(): Promise<ApplicationSecret> {
  applicationSecretPromise ??= retrieveApplicationSecret().catch(
    (error: unknown) => {
      applicationSecretPromise = undefined;
      throw error;
    },
  );

  return applicationSecretPromise;
}

export async function getDatabaseSecret(): Promise<DatabaseSecret> {
  const secret = await getApplicationSecret();

  return {
    DATABASE_URL: secret.DATABASE_URL,
  };
}

export async function getAuthenticationSecret(): Promise<AuthenticationSecret> {
  const secret = await getApplicationSecret();

  return {
    JWT_SECRET: decodeBase64Secret(secret.JWT_SECRET, "authentication"),
  };
}

export async function getEmailVerificationSecret(): Promise<EmailVerificationSecret> {
  const secret = await getApplicationSecret();

  return {
    EMAIL_VERIFICATION_SECRET: decodeBase64Secret(
      secret.EMAIL_VERIFICATION_SECRET,
      "email verification",
    ),
  };
}

export async function getResendSecret(): Promise<ResendSecret> {
  const secret = await getApplicationSecret();

  return {
    RESEND_API_KEY: secret.RESEND_API_KEY,
  };
}
