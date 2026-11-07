import type { User } from "../../domain/user.js";
import type { TermsAcceptance } from "../../domain/terms-acceptance.js";
import type { UserRegistered } from "../../domain/user-registered.event.js";

export interface IdentityTransaction {
  users: {
    insert(user: User): Promise<void>;
  };

  termsAcceptances: {
    insert(acceptance: TermsAcceptance): Promise<void>;
  };

  outbox: {
    append(event: UserRegistered): Promise<void>;
  };
}

export interface IdentityUnitOfWork {
  transaction<T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ): Promise<T>;
}
