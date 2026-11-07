import { eq } from "drizzle-orm";

import { Database } from "../../../../../infrastructure/database/client.js";
import { users } from "../../../../../infrastructure/database/schema/identity.schema.js";

import type { Email } from "../../../domain/value-objects/email.js";
import {
  AuthenticationUser,
  AuthenticationUserRepository,
} from "../../../application/ports/authentication-user-repository.js";

type AuthenticationDatabase = Pick<Database, "select">;

export class DrizzleAuthenticationUserRepository implements AuthenticationUserRepository {
  constructor(private readonly db: AuthenticationDatabase) {}

  async findByEmail(email: Email): Promise<AuthenticationUser | null> {
    const [user] = await this.db
      .select({
        userId: users.id,
        passwordHash: users.passwordHash,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);

    return user ?? null;
  }
}
