import { eq } from "drizzle-orm";

import type { Database } from "#infrastructure/database/client.js";
import { users } from "#infrastructure/database/schema/identity.schema.js";
import type { UserStatus } from "#modules/identity/domain/user.js";
import type { ActiveUserRepository } from "#modules/identity/application/ports/active-user-repository.js";

type ActiveUserDatabase = Pick<Database, "select">;

export class DrizzleActiveUserRepository implements ActiveUserRepository {
  constructor(private readonly db: ActiveUserDatabase) { }

  async findStatusById(userId: string): Promise<UserStatus | null> {
    const [user] = await this.db
      .select({
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return user.status;
  }
}
