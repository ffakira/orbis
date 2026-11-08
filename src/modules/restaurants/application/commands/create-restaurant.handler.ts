import {
  createRestaurantSchema,
  type CreateRestaurantCommand,
} from "#modules/restaurants/application/commands/create-restaurant.schema.js";
import { RestaurantMembership } from "#modules/restaurants/domain/restaurant-membership.js";
import { Restaurant } from "#modules/restaurants/domain/restaurant.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { IdGenerator } from "#modules/identity/application/ports/id-generator.js";
import type { RestaurantsUnitOfWork } from "#modules/restaurants/application/ports/unit-of-work.js";

export interface CreateRestaurantDependencies {
  ids: IdGenerator;
  clock: Clock;
  unitOfWork: RestaurantsUnitOfWork;
}

export interface CreateRestaurantResult {
  restaurantId: string;
}

export class CreateRestaurantHandler {
  constructor(private readonly dependencies: CreateRestaurantDependencies) {}

  async execute(
    command: CreateRestaurantCommand,
  ): Promise<CreateRestaurantResult> {
    const validated = createRestaurantSchema.parse(command);

    const { ids, clock, unitOfWork } = this.dependencies;

    const now = clock.now().toISOString();

    const restaurant = Restaurant.create({
      id: ids.generate(),
      name: validated.name,
      createdAt: now,
      updatedAt: now,
    });

    const ownerMembership = RestaurantMembership.create({
      id: ids.generate(),
      restaurantId: restaurant.id,
      userId: validated.userId,
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await unitOfWork.transaction(async (transaction) => {
      await transaction.restaurants.insert(restaurant);
      await transaction.memberships.insert(ownerMembership);
    });

    return {
      restaurantId: restaurant.id,
    };
  }
}
