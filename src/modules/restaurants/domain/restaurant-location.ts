import {
  restaurantLocationSchema,
  type RestaurantLocationProps,
} from "#modules/restaurants/domain/restaurant-location.schema.js";

export class RestaurantLocation {
  private constructor(
    public readonly street: string,
    public readonly number: string,
    public readonly complement: string | null,
    public readonly neighbourhood: string,
    public readonly city: string,
    public readonly state: string,
    public readonly postalCode: string,
    public readonly countryCode: "BR",
    public readonly latitude: number | null,
    public readonly longitude: number | null,
  ) {}

  static create(props: RestaurantLocationProps): RestaurantLocation {
    const validated = restaurantLocationSchema.parse(props);

    return new RestaurantLocation(
      validated.street,
      validated.number,
      validated.complement,
      validated.neighbourhood,
      validated.city,
      validated.state,
      validated.postalCode,
      validated.countryCode,
      validated.latitude,
      validated.longitude,
    );
  }
}
