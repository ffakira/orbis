import { z } from "zod";

export const restaurantRoleSchema = z.enum([
  "owner",
  "manager",
  "staff",
]);

export type RestaurantRole = z.infer<typeof restaurantRoleSchema>;
