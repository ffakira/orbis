import { z } from "zod";

export const passwordResetRequestedPayloadSchema = z.strictObject({
  userId: z.uuid(),
  tokenId: z.uuid(),
  expiresAt: z.iso.datetime(),
  occurredAt: z.iso.datetime(),
});

export type PasswordResetRequestedPayload = z.infer<
  typeof passwordResetRequestedPayloadSchema
>;
