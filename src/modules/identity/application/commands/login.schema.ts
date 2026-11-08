import { z } from "zod";

import { emailSchema } from "#modules/identity/domain/value-objects/email.schema.js";

export const loginSchema = z.strictObject({
  email: emailSchema,

  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password cannot exceed 128 characters."),
});

export type LoginCommand = z.infer<typeof loginSchema>;
