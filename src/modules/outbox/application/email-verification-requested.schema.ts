import { z } from "zod";

export const emailVerificationRequestedPayloadSchema = z.strictObject({
  userId: z.uuid(),
  tokenId: z.uuid(),
  expiresAt: z.iso.datetime(),
  occurredAt: z.iso.datetime(),
});

export type EmailVerificationRequestedPayload = z.infer<
  typeof emailVerificationRequestedPayloadSchema
>;
