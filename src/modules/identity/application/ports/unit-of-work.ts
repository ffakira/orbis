import type { User } from "../../domain/user.js";
import type { TermsAcceptance } from "../../domain/terms-acceptance.js";
import type { UserRegistered } from "../../domain/user-registered.event.js";
import type { EmailVerificationRequested } from "../../domain/email-verification-requested.event.js";
import type { AuthenticationUserRepository } from "./authentication-user-repository.js";
import type { EmailVerificationTokenRepository } from "./email-verification-token-repository.js";

export interface IdentityTransaction {
  users: {
    insert(user: User): Promise<void>;
  };

  authenticationUsers: AuthenticationUserRepository;

  termsAcceptances: {
    insert(acceptance: TermsAcceptance): Promise<void>;
  };

  emailVerificationTokens: EmailVerificationTokenRepository;

  outbox: {
    append(event: UserRegistered | EmailVerificationRequested): Promise<void>;
  };
}

export interface IdentityUnitOfWork {
  transaction<T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ): Promise<T>;
}
