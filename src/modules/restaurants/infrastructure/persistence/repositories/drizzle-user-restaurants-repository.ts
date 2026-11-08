import { eq } from "drizzle-orm";

import {
  restaurantMemberships,
  restaurants,
} from "#infrastructure/database/schema/restaurants.schema.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  UserRestaurant,
  UserRestaurantsRepository,
} from "#modules/restaurants/application/ports/user-restaurants-repository.js";

type UserRestaurantsDatabase = Pick<Database, "select">;

export class DrizzleUserRestaurantsRepository implements UserRestaurantsRepository {
  constructor(private readonly db: UserRestaurantsDatabase) {}

  async findByUserId(userId: string): Promise<UserRestaurant[]> {
    const memberships = await this.db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        role: restaurantMemberships.role,
        membershipStatus: restaurantMemberships.status,
        joinedAt: restaurantMemberships.createdAt,
      })
      .from(restaurantMemberships)
      .innerJoin(
        restaurants,
        eq(restaurantMemberships.restaurantId, restaurants.id),
      )
      .where(eq(restaurantMemberships.userId, userId));

    return memberships;
  }
}
