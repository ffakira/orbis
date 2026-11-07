import type { EmailVerificationToken } from "../../domain/email-verification-token.js";

export interface EmailVerificationTokenRepository {
  insert(token: EmailVerificationToken): Promise<void>;
}
