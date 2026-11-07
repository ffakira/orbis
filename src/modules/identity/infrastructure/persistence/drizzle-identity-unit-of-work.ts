import type {
  IdentityTransaction,
  IdentityUnitOfWork,
} from "../../application/ports/unit-of-work.js";

import type { Database } from "../../../../infrastructure/database/client.js";

import { DrizzleOutboxRepository } from "./repositories/drizzle-outbox-repository.js";
import { DrizzleTermsAcceptanceRepository } from "./repositories/drizzle-terms-acceptance-repository.js";
import { DrizzleUserRepository } from "./repositories/drizzle-user-repository.js";

export class DrizzleIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(private readonly db: Database) {}

  async transaction<T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const transaction: IdentityTransaction = {
        users: new DrizzleUserRepository(tx),
        termsAcceptances: new DrizzleTermsAcceptanceRepository(tx),
        outbox: new DrizzleOutboxRepository(tx),
      };

      return operation(transaction);
    });
  }
}
