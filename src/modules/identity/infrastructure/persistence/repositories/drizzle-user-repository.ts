import { and, eq } from "drizzle-orm";

import type { User } from "../../../domain/user.js";
import { EmailAlreadyRegisteredError } from "../../../application/email-already-registered.error.js";

import { DatabaseExecutor } from "../../../../../infrastructure/database/client.js";
import { users } from "../../../../../infrastructure/database/schema/identity.schema.js";

interface PostgreSqlError {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

function isEmailUniqueViolation(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);

    const databaseError = current as PostgreSqlError;

    if (
      databaseError.code === "23505" &&
      databaseError.constraint === "users_email_unique"
    ) {
      return true;
    }

    current = databaseError.cause;
  }

  return false;
}

export class DrizzleUserRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(user: User): Promise<void> {
    try {
      await this.db.insert(users).values({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email.value,
        phone: user.phone,
        passwordHash: user.passwordHash,
        status: user.status,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      });
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError();
      }

      throw error;
    }
  }

  async activate(userId: string, activatedAt: Date): Promise<boolean> {
    const [activatedUser] = await this.db
      .update(users)
      .set({
        status: "active",
        updatedAt: activatedAt,
      })
      .where(
        and(
          eq(users.id, userId),
          eq(users.status, "pending_email_verification"),
        ),
      )
      .returning({
        id: users.id,
      });

    return activatedUser !== undefined;
  }
}
