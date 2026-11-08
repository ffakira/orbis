import { and, eq } from "drizzle-orm";

import { users } from "#infrastructure/database/schema/identity.schema.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  EmailVerificationRecipient,
  EmailVerificationRecipientRepository,
  PasswordResetRecipient,
} from "#modules/outbox/application/ports/email-verification-recipient-repository.js";

type RecipientDatabase = Pick<Database, "select">;

export class DrizzleEmailVerificationRecipientRepository implements EmailVerificationRecipientRepository {
  constructor(private readonly db: RecipientDatabase) {}

  async findPendingByUserId(
    userId: string,
  ): Promise<EmailVerificationRecipient | null> {
    const [recipient] = await this.db
      .select({
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.status, "pending_email_verification"),
        ),
      )
      .limit(1);

    return recipient ?? null;
  }

  async findActiveByUserId(
    userId: string,
  ): Promise<PasswordResetRecipient | null> {
    const [recipient] = await this.db
      .select({
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.status, "active")))
      .limit(1);

    return recipient ?? null;
  }
}
