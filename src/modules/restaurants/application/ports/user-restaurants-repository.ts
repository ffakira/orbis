import type {
  RestaurantMembershipStatus,
  RestaurantRole,
} from "#modules/restaurants/domain/restaurant-membership.schema.js";

export interface UserRestaurant {
  id: string;
  name: string;
  role: RestaurantRole;
  membershipStatus: RestaurantMembershipStatus;
  joinedAt: Date;
}

export interface UserRestaurantsRepository {
  findByUserId(userId: string): Promise<UserRestaurant[]>;
}
