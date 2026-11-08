import { eq } from "drizzle-orm";

import { users } from "#infrastructure/database/schema/identity.schema.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  ActiveUser,
  ActiveUserRepository,
} from "#modules/identity/application/ports/active-user-repository.js";

type ActiveUserDatabase = Pick<Database, "select">;

export class DrizzleActiveUserRepository implements ActiveUserRepository {
  constructor(private readonly db: ActiveUserDatabase) {}

  async findById(userId: string): Promise<ActiveUser | null> {
    const [user] = await this.db
      .select({
        status: users.status,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }
}
