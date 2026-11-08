import {
  restaurantMembershipSchema,
  type CreateRestaurantMembershipProps,
} from "#modules/restaurants/domain/restaurant-membership.schema.js";

export class RestaurantMembership {
  private constructor(
    public readonly id: string,
    public readonly restaurantId: string,
    public readonly userId: string,
    public readonly role: CreateRestaurantMembershipProps["role"],
    public readonly status: CreateRestaurantMembershipProps["status"],
    public readonly createdAt: string,
    public readonly updatedAt: string,
  ) {}

  static create(props: CreateRestaurantMembershipProps): RestaurantMembership {
    const validated = restaurantMembershipSchema.parse(props);

    return new RestaurantMembership(
      validated.id,
      validated.restaurantId,
      validated.userId,
      validated.role,
      validated.status,
      validated.createdAt,
      validated.updatedAt,
    );
  }
}
