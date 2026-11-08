import { InvalidPasswordResetTokenError } from "#modules/identity/application/invalid-password-reset-token.error.js";

import type { ConfirmPasswordRecoveryCommand } from "#modules/identity/application/commands/confirm-password-recovery.schema.js";
import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { PasswordHasher } from "#modules/identity/application/ports/password-hasher.js";
import type { PasswordResetTokenSigner } from "#modules/identity/application/ports/password-reset-token-signer.js";
import type { IdentityUnitOfWork } from "#modules/identity/application/ports/unit-of-work.js";

export interface ConfirmPasswordRecoveryDependencies {
  clock: Clock;
  passwordHasher: PasswordHasher;
  passwordResetTokenSigner: PasswordResetTokenSigner;
  unitOfWork: IdentityUnitOfWork;
}

export interface ConfirmPasswordRecoveryResult {
  passwordReset: true;
}

export class ConfirmPasswordRecoveryHandler {
  constructor(
    private readonly dependencies: ConfirmPasswordRecoveryDependencies,
  ) {}

  async execute(
    command: ConfirmPasswordRecoveryCommand,
  ): Promise<ConfirmPasswordRecoveryResult> {
    const { clock, passwordHasher, passwordResetTokenSigner, unitOfWork } =
      this.dependencies;

    const passwordHash = await passwordHasher.hash(command.password);
    const tokenHash = passwordResetTokenSigner.hashToken(command.token);
    const consumedAt = clock.now();

    await unitOfWork.transaction(async (transaction) => {
      const userId = await transaction.passwordResetTokens.consume(
        tokenHash,
        consumedAt,
      );

      if (!userId) {
        throw new InvalidPasswordResetTokenError();
      }

      const updated = await transaction.users.resetPassword(
        userId,
        passwordHash,
        consumedAt,
      );

      if (!updated) {
        throw new InvalidPasswordResetTokenError();
      }
    });

    return {
      passwordReset: true,
    };
  }
}
