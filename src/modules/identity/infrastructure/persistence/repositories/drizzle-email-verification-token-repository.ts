import { and, eq, gt, isNull } from "drizzle-orm";

import { emailVerificationTokens } from "#infrastructure/database/schema/identity.schema.js";

import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import type { EmailVerificationToken } from "#modules/identity/domain/email-verification-token.js";

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

  async consume(tokenHash: string, consumedAt: Date): Promise<string | null> {
    const [consumedToken] = await this.db
      .update(emailVerificationTokens)
      .set({
        consumedAt,
      })
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.consumedAt),
          isNull(emailVerificationTokens.revokedAt),
          gt(emailVerificationTokens.expiresAt, consumedAt),
        ),
      )
      .returning({
        userId: emailVerificationTokens.userId,
      });

    return consumedToken?.userId ?? null;
  }
}
