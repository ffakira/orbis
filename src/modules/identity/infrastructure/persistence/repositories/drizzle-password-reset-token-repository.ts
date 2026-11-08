import { and, eq, gt, isNull } from "drizzle-orm";

import { passwordResetTokens } from "#infrastructure/database/schema/identity.schema.js";

import type { DatabaseExecutor } from "#infrastructure/database/client.js";
import type { PasswordResetToken } from "#modules/identity/domain/password-reset-token.js";

export class DrizzlePasswordResetTokenRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async insert(token: PasswordResetToken): Promise<void> {
    await this.db.insert(passwordResetTokens).values({
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    });
  }

  async consume(tokenHash: string, consumedAt: Date): Promise<string | null> {
    const [consumedToken] = await this.db
      .update(passwordResetTokens)
      .set({
        consumedAt,
      })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, consumedAt),
        ),
      )
      .returning({
        userId: passwordResetTokens.userId,
      });

    return consumedToken?.userId ?? null;
  }
}
