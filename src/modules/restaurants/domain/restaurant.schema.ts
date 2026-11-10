import { z } from "zod";

import { restaurantLocationSchema } from "#modules/restaurants/domain/restaurant-location.schema.js";

export const restaurantSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  location: restaurantLocationSchema.nullable().default(null),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type CreateRestaurantProps = z.input<typeof restaurantSchema>;
