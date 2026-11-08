import { DrizzleRestaurantMembershipRepository } from "#modules/restaurants/infrastructure/persistence/repositories/drizzle-restaurant-membership-repository.js";
import { DrizzleRestaurantRepository } from "#modules/restaurants/infrastructure/persistence/repositories/drizzle-restaurant-repository.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  RestaurantsTransaction,
  RestaurantsUnitOfWork,
} from "#modules/restaurants/application/ports/unit-of-work.js";

export class DrizzleRestaurantsUnitOfWork implements RestaurantsUnitOfWork {
  constructor(private readonly db: Database) {}

  async transaction<T>(
    operation: (transaction: RestaurantsTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const transaction: RestaurantsTransaction = {
        restaurants: new DrizzleRestaurantRepository(tx),
        memberships: new DrizzleRestaurantMembershipRepository(tx),
      };

      return operation(transaction);
    });
  }
}
