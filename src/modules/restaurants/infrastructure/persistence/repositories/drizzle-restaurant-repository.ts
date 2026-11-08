import { restaurants } from "#infrastructure/database/schema/restaurants.schema.js";

import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import type { Restaurant } from "#modules/restaurants/domain/restaurant.js";

export class DrizzleRestaurantRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(restaurant: Restaurant): Promise<void> {
    await this.db.insert(restaurants).values({
      id: restaurant.id,
      name: restaurant.name,
      createdAt: new Date(restaurant.createdAt),
      updatedAt: new Date(restaurant.updatedAt),
    });
  }
}
