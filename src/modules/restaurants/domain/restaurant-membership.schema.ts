import { z } from "zod";

import { restaurantRoleSchema } from "#modules/restaurants/domain/restaurant-role.js";

export const restaurantMembershipSchema = z.object({
  id: z.string().trim().min(1),
  restaurantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  role: restaurantRoleSchema,
  createdAt: z.iso.datetime({ offset: true }),
});

export type CreateRestaurantMembershipProps = z.infer<
  typeof restaurantMembershipSchema
>;
