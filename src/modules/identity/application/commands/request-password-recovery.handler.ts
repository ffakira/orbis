import { PasswordResetRequested } from "#modules/identity/domain/password-reset-requested.event.js";
import { PasswordResetToken } from "#modules/identity/domain/password-reset-token.js";
import { Email } from "#modules/identity/domain/value-objects/email.js";

import type { RequestPasswordRecoveryCommand } from "#modules/identity/application/commands/request-password-recovery.schema.js";
import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { IdGenerator } from "#modules/identity/application/ports/id-generator.js";
import type { PasswordResetTokenSigner } from "#modules/identity/application/ports/password-reset-token-signer.js";
import type { IdentityUnitOfWork } from "#modules/identity/application/ports/unit-of-work.js";

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface RequestPasswordRecoveryDependencies {
  ids: IdGenerator;
  clock: Clock;
  passwordResetTokenSigner: PasswordResetTokenSigner;
  unitOfWork: IdentityUnitOfWork;
}

export interface RequestPasswordRecoveryResult {
  requested: true;
}

export class RequestPasswordRecoveryHandler {
  constructor(
    private readonly dependencies: RequestPasswordRecoveryDependencies,
  ) {}

  async execute(
    command: RequestPasswordRecoveryCommand,
  ): Promise<RequestPasswordRecoveryResult> {
    const { ids, clock, passwordResetTokenSigner, unitOfWork } =
      this.dependencies;

    const now = clock.now();
    const occurredAt = now.toISOString();

    await unitOfWork.transaction(async (transaction) => {
      const user = await transaction.authenticationUsers.findByEmail(
        Email.create(command.email),
      );

      if (user?.status !== "active") {
        return;
      }

      const tokenId = ids.generate();
      const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);
      const expiresAtIso = expiresAt.toISOString();

      const bearerToken = passwordResetTokenSigner.deriveToken({
        tokenId,
        userId: user.userId,
        expiresAt: expiresAtIso,
      });

      const resetToken = PasswordResetToken.create({
        id: tokenId,
        userId: user.userId,
        tokenHash: passwordResetTokenSigner.hashToken(bearerToken),
        createdAt: now,
        expiresAt,
      });

      const event = new PasswordResetRequested(
        ids.generate(),
        user.userId,
        tokenId,
        expiresAtIso,
        occurredAt,
      );

      await transaction.passwordResetTokens.insert(resetToken);
      await transaction.outbox.append(event);
    });

    return {
      requested: true,
    };
  }
}
