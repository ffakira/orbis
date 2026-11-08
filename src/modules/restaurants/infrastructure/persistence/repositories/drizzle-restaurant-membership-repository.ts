import { restaurantMemberships } from "#infrastructure/database/schema/restaurants.schema.js";

import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import type { RestaurantMembership } from "#modules/restaurants/domain/restaurant-membership.js";

export class DrizzleRestaurantMembershipRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(membership: RestaurantMembership): Promise<void> {
    await this.db.insert(restaurantMemberships).values({
      id: membership.id,
      restaurantId: membership.restaurantId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      createdAt: new Date(membership.createdAt),
      updatedAt: new Date(membership.updatedAt),
    });
  }
}
