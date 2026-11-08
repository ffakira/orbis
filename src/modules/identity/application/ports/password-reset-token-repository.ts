import type { PasswordResetToken } from "#modules/identity/domain/password-reset-token.js";

export interface PasswordResetTokenRepository {
  insert(token: PasswordResetToken): Promise<void>;
  consume(tokenHash: string, consumedAt: Date): Promise<string | null>;
}
