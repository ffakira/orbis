import { DrizzleAuthenticationUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-authentication-user-repository.js";
import { DrizzleEmailVerificationTokenRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-email-verification-token-repository.js";
import { DrizzlePasswordResetTokenRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-password-reset-token-repository.js";
import { DrizzleTermsAcceptanceRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-terms-acceptance-repository.js";
import { DrizzleUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-user-repository.js";
import { DrizzleOutboxRepository } from "#modules/outbox/infrastructure/persistence/drizzle-outbox-repository.js";

import type { Database } from "#infrastructure/database/client.js";
import type {
  IdentityTransaction,
  IdentityUnitOfWork,
} from "#modules/identity/application/ports/unit-of-work.js";

export class DrizzleIdentityUnitOfWork implements IdentityUnitOfWork {
  private readonly outboxRepository: DrizzleOutboxRepository;

  constructor(private readonly db: Database) {
    this.outboxRepository = new DrizzleOutboxRepository(db);
  }

  async transaction<T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const transaction: IdentityTransaction = {
        users: new DrizzleUserRepository(tx),
        authenticationUsers: new DrizzleAuthenticationUserRepository(tx),
        termsAcceptances: new DrizzleTermsAcceptanceRepository(tx),
        emailVerificationTokens: new DrizzleEmailVerificationTokenRepository(
          tx,
        ),
        passwordResetTokens: new DrizzlePasswordResetTokenRepository(tx),
        outbox: {
          append: (event) => this.outboxRepository.append(event, tx),
        },
      };

      return operation(transaction);
    });
  }
}
