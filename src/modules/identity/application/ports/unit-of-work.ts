import type { User } from "#modules/identity/domain/user.js";
import type { TermsAcceptance } from "#modules/identity/domain/terms-acceptance.js";
import type { UserRegistered } from "#modules/identity/domain/user-registered.event.js";
import type { EmailVerificationRequested } from "#modules/identity/domain/email-verification-requested.event.js";
import type { AuthenticationUserRepository } from "#modules/identity/application/ports/authentication-user-repository.js";
import type { EmailVerificationTokenRepository } from "#modules/identity/application/ports/email-verification-token-repository.js";

export interface IdentityTransaction {
  users: {
    insert(user: User): Promise<void>;
    activate(userId: string, activatedAt: Date): Promise<boolean>;
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
