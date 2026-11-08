import { eq } from "drizzle-orm";

import { users } from "#infrastructure/database/schema/identity.schema.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  UserProfile,
  UserProfileRepository,
} from "#modules/identity/application/ports/user-profile-repository.js";

type ProfileDatabase = Pick<Database, "select">;

export class DrizzleUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: ProfileDatabase) {}

  async findById(userId: string): Promise<UserProfile | null> {
    const [user] = await this.db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }
}
