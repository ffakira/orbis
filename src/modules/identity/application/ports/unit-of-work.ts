import type { AuthenticationUserRepository } from "#modules/identity/application/ports/authentication-user-repository.js";
import type { EmailVerificationTokenRepository } from "#modules/identity/application/ports/email-verification-token-repository.js";
import type { PasswordResetTokenRepository } from "#modules/identity/application/ports/password-reset-token-repository.js";
import type { IdentityOutboxEvent } from "#modules/identity/domain/identity-outbox.event.js";
import type { TermsAcceptance } from "#modules/identity/domain/terms-acceptance.js";
import type { User } from "#modules/identity/domain/user.js";

export interface IdentityTransaction {
  users: {
    insert(user: User): Promise<void>;
    activate(userId: string, activatedAt: Date): Promise<boolean>;
    resetPassword(
      userId: string,
      passwordHash: string,
      updatedAt: Date,
    ): Promise<boolean>;
  };

  authenticationUsers: AuthenticationUserRepository;

  termsAcceptances: {
    insert(acceptance: TermsAcceptance): Promise<void>;
  };

  emailVerificationTokens: EmailVerificationTokenRepository;

  passwordResetTokens: PasswordResetTokenRepository;

  outbox: {
    append(event: IdentityOutboxEvent): Promise<void>;
  };
}

export interface IdentityUnitOfWork {
  transaction<T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ): Promise<T>;
}
