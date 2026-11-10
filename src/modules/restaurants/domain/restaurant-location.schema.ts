import { z } from "zod";

const brazilianStateSchema = z
  .string()
  .trim()
  .length(2)
  .transform((value) => value.toUpperCase());

const postalCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().length(8));

export const restaurantLocationSchema = z
  .object({
    street: z.string().trim().min(1).max(160),
    number: z.string().trim().min(1).max(20),
    complement: z.string().trim().max(100).nullable(),
    neighbourhood: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    state: brazilianStateSchema,
    postalCode: postalCodeSchema,
    countryCode: z.literal("BR"),

    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .refine(
    (location) =>
      (location.latitude === null) === (location.longitude === null),
    {
      message:
        "Latitude and longitude must either both be provided or both be null.",
      path: ["latitude"],
    },
  );

export type RestaurantLocationProps = z.input<typeof restaurantLocationSchema>;
