import { Pool } from "pg";

import { getDatabaseSecret } from "#infrastructure/secrets/secrets-manager.js";

let poolPromise: Promise<Pool> | undefined;

async function createDatabasePool(): Promise<Pool> {
  const { DATABASE_URL } = await getDatabaseSecret();

  const pool = new Pool({
    connectionString: DATABASE_URL,

    max: 2,

    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,

    ssl: {
      rejectUnauthorized: true,
    },

    application_name: "restaurant-cmv-api",
  });

  pool.on("error", (error: Error) => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
  });

  try {
    await pool.query("SELECT 1");

    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

export async function getDatabasePool(): Promise<Pool> {
  poolPromise ??= createDatabasePool().catch((error: unknown) => {
    poolPromise = undefined;
    throw error;
  });

  return poolPromise;
}
