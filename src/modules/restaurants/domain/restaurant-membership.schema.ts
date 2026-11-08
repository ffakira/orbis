import { z } from "zod";

import {
  restaurantRoleSchema,
  type RestaurantRole,
} from "#modules/restaurants/domain/restaurant-role.js";

export { restaurantRoleSchema };
export type { RestaurantRole };

export const restaurantMembershipStatusSchema = z.enum(["active", "suspended"]);

export type RestaurantMembershipStatus = z.infer<
  typeof restaurantMembershipStatusSchema
>;

export const restaurantMembershipSchema = z.object({
  id: z.string().trim().min(1),
  restaurantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  role: restaurantRoleSchema,
  status: restaurantMembershipStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type CreateRestaurantMembershipProps = z.infer<
  typeof restaurantMembershipSchema
>;
