import { users } from "../../schema/identity.schema.js";
import type { DatabaseExecutor } from "../../client.js";

import type { User } from "../../../../modules/identity/domain/user.js";
import { EmailAlreadyRegisteredError } from "../../../../modules/identity/application/email-already-registered.error.js";

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
}
