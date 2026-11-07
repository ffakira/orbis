import { z } from "zod";

export const verifyEmailSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, {
    message: "The verification token is invalid.",
  }),
});

export type VerifyEmailCommand = z.infer<typeof verifyEmailSchema>;
