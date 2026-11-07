import type { DatabaseExecutor } from "../../../../../infrastructure/database/client.js";
import { emailVerificationTokens } from "../../../../../infrastructure/database/schema/identity.schema.js";
import type { EmailVerificationToken } from "../../../domain/email-verification-token.js";

export class DrizzleEmailVerificationTokenRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(token: EmailVerificationToken): Promise<void> {
    await this.db.insert(emailVerificationTokens).values({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    });
  }
}
