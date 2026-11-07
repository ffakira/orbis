import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { EmailVerificationTokenSigner } from "#modules/identity/application/ports/email-verification-token-signer.js";
import type { IdentityUnitOfWork } from "#modules/identity/application/ports/unit-of-work.js";

import type { VerifyEmailCommand } from "#modules/identity/application/commands/verify-email.schema.js";

import { InvalidEmailVerificationTokenError } from "#modules/identity/application/invalid-email-verification-token.error.js";

export interface VerifyEmailDependencies {
  clock: Clock;
  emailVerificationTokenSigner: EmailVerificationTokenSigner;
  unitOfWork: IdentityUnitOfWork;
}

export interface VerifyEmailResult {
  verified: true;
}

export class VerifyEmailHandler {
  constructor(private readonly dependencies: VerifyEmailDependencies) {}

  async execute(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
    const { clock, emailVerificationTokenSigner, unitOfWork } =
      this.dependencies;

    const tokenHash = emailVerificationTokenSigner.hashToken(command.token);

    const consumedAt = clock.now();

    await unitOfWork.transaction(async (transaction) => {
      const userId = await transaction.emailVerificationTokens.consume(
        tokenHash,
        consumedAt,
      );

      if (!userId) {
        throw new InvalidEmailVerificationTokenError();
      }

      const activated = await transaction.users.activate(userId, consumedAt);

      if (!activated) {
        throw new InvalidEmailVerificationTokenError();
      }
    });

    return {
      verified: true,
    };
  }
}
