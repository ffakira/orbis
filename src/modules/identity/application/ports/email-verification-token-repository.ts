import type { EmailVerificationToken } from "../../domain/email-verification-token.js";

export interface EmailVerificationTokenRepository {
  insert(token: EmailVerificationToken): Promise<void>;
  consume(tokenHash: string, consumedAt: Date): Promise<string | null>;
}
