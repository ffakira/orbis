import type {
  IdentityTransaction,
  IdentityUnitOfWork,
} from "#modules/identity/application/ports/unit-of-work.js";

import type { Database } from "#infrastructure/database/client.js";

import { DrizzleAuthenticationUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-authentication-user-repository.js";
import { DrizzleEmailVerificationTokenRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-email-verification-token-repository.js";
import { DrizzleOutboxRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-outbox-repository.js";
import { DrizzleTermsAcceptanceRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-terms-acceptance-repository.js";
import { DrizzleUserRepository } from "#modules/identity/infrastructure/persistence/repositories/drizzle-user-repository.js";

export class DrizzleIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(private readonly db: Database) {}

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
        outbox: new DrizzleOutboxRepository(tx),
      };

      return operation(transaction);
    });
  }
}
