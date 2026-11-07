import "../../config/env.js";

import { Buffer } from "node:buffer";

interface DatabaseSecret {
  DATABASE_URL: string;
}

interface AuthenticationSecret {
  JWT_SECRET: Uint8Array;
}

interface EmailVerificationSecret {
  EMAIL_VERIFICATION_SECRET: Uint8Array;
}

interface SecretsManagerResponse {
  SecretString?: string;
}

let databaseSecretPromise: Promise<DatabaseSecret> | undefined;
let authenticationSecretPromise: Promise<AuthenticationSecret> | undefined;
let emailVerificationSecretPromise:
  | Promise<EmailVerificationSecret>
  | undefined;

function parseSecretString(secretString: string, secretName: string): unknown {
  try {
    return JSON.parse(secretString);
  } catch {
    throw new Error(`${secretName} secret contains invalid JSON`);
  }
}

async function retrieveSecretString(
  secretArn: string,
  secretName: string,
): Promise<string> {
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
      `Secrets Manager extension returned HTTP ${response.status} while retrieving ${secretName}`,
    );
  }

  const result = (await response.json()) as SecretsManagerResponse;

  if (!result.SecretString) {
    throw new Error(`${secretName} secret has no SecretString`);
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

function validateDatabaseSecret(value: unknown): DatabaseSecret {
  if (
    typeof value !== "object" ||
    value === null ||
    !("DATABASE_URL" in value) ||
    typeof value.DATABASE_URL !== "string" ||
    value.DATABASE_URL.trim() === ""
  ) {
    throw new Error("Invalid database secret: DATABASE_URL is missing");
  }

  const connectionString = value.DATABASE_URL;
  const url = new URL(connectionString);

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Invalid database URL protocol");
  }

  return { DATABASE_URL: connectionString };
}

function validateAuthenticationSecret(value: unknown): AuthenticationSecret {
  if (
    typeof value !== "object" ||
    value === null ||
    !("JWT_SECRET" in value) ||
    typeof value.JWT_SECRET !== "string" ||
    value.JWT_SECRET.trim() === ""
  ) {
    throw new Error("Invalid authentication secret: JWT_SECRET is missing");
  }

  return {
    JWT_SECRET: decodeBase64Secret(value.JWT_SECRET, "authentication"),
  };
}

function validateEmailVerificationSecret(
  value: unknown,
): EmailVerificationSecret {
  if (
    typeof value !== "object" ||
    value === null ||
    !("EMAIL_VERIFICATION_SECRET" in value) ||
    typeof value.EMAIL_VERIFICATION_SECRET !== "string" ||
    value.EMAIL_VERIFICATION_SECRET.trim() === ""
  ) {
    throw new Error(
      "Invalid email verification secret: EMAIL_VERIFICATION_SECRET is missing",
    );
  }

  return {
    EMAIL_VERIFICATION_SECRET: decodeBase64Secret(
      value.EMAIL_VERIFICATION_SECRET,
      "email verification",
    ),
  };
}

async function retrieveDatabaseSecret(): Promise<DatabaseSecret> {
  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("Neither DB_SECRET_ARN nor DATABASE_URL is configured");
    }

    return validateDatabaseSecret({ DATABASE_URL: databaseUrl });
  }

  const secretString = await retrieveSecretString(secretArn, "Database");

  return validateDatabaseSecret(parseSecretString(secretString, "Database"));
}

async function retrieveAuthenticationSecret(): Promise<AuthenticationSecret> {
  const secretArn = process.env.AUTHENTICATION_SECRET_ARN;

  if (!secretArn) {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "Neither AUTHENTICATION_SECRET_ARN nor JWT_SECRET is configured",
      );
    }

    return validateAuthenticationSecret({ JWT_SECRET: jwtSecret });
  }

  const secretString = await retrieveSecretString(secretArn, "Authentication");

  return validateAuthenticationSecret(
    parseSecretString(secretString, "Authentication"),
  );
}

async function retrieveEmailVerificationSecret(): Promise<EmailVerificationSecret> {
  const secretArn = process.env.EMAIL_VERIFICATION_SECRET_ARN;

  if (!secretArn) {
    const emailVerificationSecret =
      process.env.EMAIL_VERIFICATION_SECRET;

    if (!emailVerificationSecret) {
      throw new Error(
        "Neither EMAIL_VERIFICATION_SECRET_ARN nor EMAIL_VERIFICATION_SECRET is configured",
      );
    }

    return validateEmailVerificationSecret({
      EMAIL_VERIFICATION_SECRET: emailVerificationSecret,
    });
  }

  const secretString = await retrieveSecretString(
    secretArn,
    "Email verification",
  );

  return validateEmailVerificationSecret(
    parseSecretString(secretString, "Email verification"),
  );
}

export function getDatabaseSecret(): Promise<DatabaseSecret> {
  databaseSecretPromise ??= retrieveDatabaseSecret().catch((error: unknown) => {
    databaseSecretPromise = undefined;
    throw error;
  });

  return databaseSecretPromise;
}

export function getAuthenticationSecret(): Promise<AuthenticationSecret> {
  authenticationSecretPromise ??= retrieveAuthenticationSecret().catch(
    (error: unknown) => {
      authenticationSecretPromise = undefined;
      throw error;
    },
  );

  return authenticationSecretPromise;
}

export function getEmailVerificationSecret(): Promise<EmailVerificationSecret> {
  emailVerificationSecretPromise ??= retrieveEmailVerificationSecret().catch(
    (error: unknown) => {
      emailVerificationSecretPromise = undefined;
      throw error;
    },
  );

  return emailVerificationSecretPromise;
}
