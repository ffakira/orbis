import { z } from "zod";

export const createRestaurantSchema = z.strictObject({
  userId: z.uuid(),
  name: z.string().trim().min(1).max(120),
});

export type CreateRestaurantCommand = z.infer<typeof createRestaurantSchema>;
