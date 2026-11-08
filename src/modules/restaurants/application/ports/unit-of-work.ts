import type { RestaurantMembership } from "#modules/restaurants/domain/restaurant-membership.js";
import type { Restaurant } from "#modules/restaurants/domain/restaurant.js";

export interface RestaurantsTransaction {
  restaurants: {
    insert(restaurant: Restaurant): Promise<void>;
  };

  memberships: {
    insert(membership: RestaurantMembership): Promise<void>;
  };
}

export interface RestaurantsUnitOfWork {
  transaction<T>(
    operation: (transaction: RestaurantsTransaction) => Promise<T>,
  ): Promise<T>;
}
