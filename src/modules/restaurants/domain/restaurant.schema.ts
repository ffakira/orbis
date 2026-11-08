import { z } from "zod";

export const restaurantSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type CreateRestaurantProps = z.infer<typeof restaurantSchema>;
