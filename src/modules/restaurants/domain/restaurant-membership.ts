import {
  restaurantMembershipSchema,
  type CreateRestaurantMembershipProps,
} from "#modules/restaurants/domain/restaurant-membership.schema.js";

import type { RestaurantRole } from "#modules/restaurants/domain/restaurant-role.js";

export class RestaurantMembership {
  private constructor(
    public readonly id: string,
    public readonly restaurantId: string,
    public readonly userId: string,
    public readonly role: RestaurantRole,
    public readonly createdAt: string,
  ) {}

  static create(
    props: CreateRestaurantMembershipProps,
  ): RestaurantMembership {
    const validated = restaurantMembershipSchema.parse(props);

    return new RestaurantMembership(
      validated.id,
      validated.restaurantId,
      validated.userId,
      validated.role,
      validated.createdAt,
    );
  }
}
