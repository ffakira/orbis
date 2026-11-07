import { z } from "zod";

export const emailVerificationTokenSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),

  // SHA-256 hash of the bearer token, encoded as lowercase hexadecimal.
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),

  expiresAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});

export interface IssueEmailVerificationTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}
