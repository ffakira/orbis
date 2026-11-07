import { z } from "zod";
import { emailSchema } from "../../domain/value-objects/email.schema.js";

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, {
  message: "Phone number must use international E.164 format.",
});

export const registerUserSchema = z.strictObject({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(100, "First name cannot exceed 100 characters."),

  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(100, "Last name cannot exceed 100 characters."),

  email: emailSchema,

  phone: phoneSchema,

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .max(128, "Password cannot exceed 128 characters."),

  acceptTerms: z.literal(true, {
    error: "You must accept the Terms of Service.",
  }),
});

export type RegisterUserCommand = z.infer<typeof registerUserSchema>;
