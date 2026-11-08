import { z } from "zod";

export const confirmPasswordRecoverySchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, {
    message: "The password reset token is invalid.",
  }),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .max(128, "Password cannot exceed 128 characters."),
});

export type ConfirmPasswordRecoveryCommand = z.infer<
  typeof confirmPasswordRecoverySchema
>;
