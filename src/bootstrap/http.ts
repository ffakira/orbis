import { createApp } from "#delivery/http/app.js";

import {
  getLoginHandler,
  getRegisterUserHandler,
  getVerifyEmailHandler,
} from "#bootstrap/identity.js";

import { getDatabasePool } from "#infrastructure/database/postgres.js";

async function checkDatabaseReadiness() {
  const pool = await getDatabasePool();

  const result = await pool.query<{
    database: string;
    username: string;
    connected_at: Date;
  }>(`
    SELECT
      current_database() AS database,
      current_user AS username,
      NOW() AS connected_at
  `);

  const database = result.rows[0];

  if (!database) {
    throw new Error("Database readiness query returned no result.");
  }

  return {
    database: database.database,
    username: database.username,
    connectedAt: database.connected_at,
  };
}

export const app = createApp({
  getLoginHandler,
  getRegisterUserHandler,
  getVerifyEmailHandler,
  checkDatabaseReadiness,
});
