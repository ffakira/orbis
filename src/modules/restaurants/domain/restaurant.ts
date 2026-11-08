import {
  restaurantSchema,
  type CreateRestaurantProps,
} from "#modules/restaurants/domain/restaurant.schema.js";

export class Restaurant {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdAt: string,
    public readonly updatedAt: string,
  ) {}

  static create(props: CreateRestaurantProps): Restaurant {
    const validated = restaurantSchema.parse(props);

    return new Restaurant(
      validated.id,
      validated.name,
      validated.createdAt,
      validated.updatedAt,
    );
  }
}
