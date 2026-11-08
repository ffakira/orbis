import type {
  UserRestaurant,
  UserRestaurantsRepository,
} from "#modules/restaurants/application/ports/user-restaurants-repository.js";

export interface GetUserRestaurantsDependencies {
  userRestaurants: UserRestaurantsRepository;
}

export class GetUserRestaurantsHandler {
  constructor(private readonly dependencies: GetUserRestaurantsDependencies) {}

  async execute(userId: string): Promise<UserRestaurant[]> {
    return this.dependencies.userRestaurants.findByUserId(userId);
  }
}
