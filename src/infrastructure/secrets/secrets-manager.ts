import "../../config/env.js";

interface DatabaseSecret {
  DATABASE_URL: string;
}

interface SecretsManagerResponse {
  SecretString?: string;
}

let databaseSecretPromise: Promise<DatabaseSecret> | undefined;

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

async function retrieveDatabaseSecret(): Promise<DatabaseSecret> {
  const secretArn = process.env.DB_SECRET_ARN;

  // Local development uses the .env connection string.
  if (!secretArn) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "Neither DB_SECRET_ARN nor DATABASE_URL is configured",
      );
    }

    return validateDatabaseSecret({ DATABASE_URL: databaseUrl });
  }

  // Production retrieves the secret through the Lambda extension.
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!sessionToken) {
    throw new Error("AWS_SESSION_TOKEN environment variable is missing");
  }

  const port =
    process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT ?? "2773";

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
      `Secrets Manager extension returned HTTP ${response.status}`,
    );
  }

  const result = (await response.json()) as SecretsManagerResponse;

  if (!result.SecretString) {
    throw new Error("Database secret has no SecretString");
  }

  let parsedSecret: unknown;

  try {
    parsedSecret = JSON.parse(result.SecretString);
  } catch {
    throw new Error("Database secret contains invalid JSON");
  }

  return validateDatabaseSecret(parsedSecret);
}

export function getDatabaseSecret(): Promise<DatabaseSecret> {
  databaseSecretPromise ??= retrieveDatabaseSecret().catch(
    (error: unknown) => {
      databaseSecretPromise = undefined;
      throw error;
    },
  );

  return databaseSecretPromise;
}
