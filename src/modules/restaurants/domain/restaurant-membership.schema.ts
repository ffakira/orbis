import { z } from "zod";

export const restaurantRoleSchema = z.enum(["owner", "manager", "staff"]);

export const restaurantMembershipStatusSchema = z.enum(["active", "suspended"]);

export const restaurantMembershipSchema = z.object({
  id: z.string().trim().min(1),
  restaurantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  role: restaurantRoleSchema,
  status: restaurantMembershipStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type RestaurantRole = z.infer<typeof restaurantRoleSchema>;
export type RestaurantMembershipStatus = z.infer<
  typeof restaurantMembershipStatusSchema
>;
export type CreateRestaurantMembershipProps = z.infer<
  typeof restaurantMembershipSchema
>;
