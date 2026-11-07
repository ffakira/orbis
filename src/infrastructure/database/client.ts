import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDatabasePool } from "./postgres.js";
import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

/**
 * The common insert capability shared by the database and
 * transaction-scoped Drizzle executors.
 */
export type DatabaseExecutor = Pick<Database, "insert">;

let databasePromise: Promise<Database> | undefined;

export async function getDatabase(): Promise<Database> {
  databasePromise ??= (async () => {
    const pool = await getDatabasePool();

    return drizzle(pool, { schema });
  })().catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}
