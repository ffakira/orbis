import { restaurants } from "#infrastructure/database/schema/restaurants.schema.js";

import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import type { Restaurant } from "#modules/restaurants/domain/restaurant.js";

export class DrizzleRestaurantRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(restaurant: Restaurant): Promise<void> {
    const location = restaurant.location;

    await this.db.insert(restaurants).values({
      id: restaurant.id,
      name: restaurant.name,

      street: location?.street ?? null,
      number: location?.number ?? null,
      complement: location?.complement ?? null,
      neighbourhood: location?.neighbourhood ?? null,
      city: location?.city ?? null,
      state: location?.state ?? null,
      postalCode: location?.postalCode ?? null,
      countryCode: location?.countryCode ?? null,

      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,

      createdAt: new Date(restaurant.createdAt),
      updatedAt: new Date(restaurant.updatedAt),
    });
  }
}
