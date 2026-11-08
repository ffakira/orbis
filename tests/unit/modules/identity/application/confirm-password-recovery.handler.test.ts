import { describe, expect, it, vi } from "vitest";

import { ConfirmPasswordRecoveryHandler } from "#modules/identity/application/commands/confirm-password-recovery.handler.js";
import { InvalidPasswordResetTokenError } from "#modules/identity/application/invalid-password-reset-token.error.js";

import type { IdentityTransaction } from "#modules/identity/application/ports/unit-of-work.js";

const bearerToken = "A".repeat(43);
const tokenHash = "b".repeat(64);
const passwordHash = "synthetic-argon2id-password-hash";
const userId = "00000000-0000-4000-8000-000000000001";
const consumedAt = new Date("2026-11-08T12:00:00.000Z");

const command = {
  token: bearerToken,
  password: "synthetic-new-password",
};

function createTransaction(): IdentityTransaction {
  return {
    users: {
      insert: vi.fn(async () => {}),
      activate: vi.fn(async () => true),
      updatePassword: vi.fn(async () => true),
    },

    authenticationUsers: {
      findByEmail: vi.fn(async () => null),
    },

    termsAcceptances: {
      insert: vi.fn(async () => {}),
    },

    emailVerificationTokens: {
      insert: vi.fn(async () => {}),
      consume: vi.fn(async () => null),
    },

    passwordResetTokens: {
      insert: vi.fn(async () => {}),
      consume: vi.fn(async () => userId),
    },

    outbox: {
      append: vi.fn(async () => {}),
    },
  };
}

function createHandler(transaction: IdentityTransaction) {
  const transactionSpy = vi.fn();

  const unitOfWork = {
    async transaction<T>(
      operation: (tx: IdentityTransaction) => Promise<T>,
    ): Promise<T> {
      transactionSpy();
      return operation(transaction);
    },
  };

  const hashPassword = vi.fn(async () => passwordHash);
  const hashToken = vi.fn(() => tokenHash);
  const clockNow = vi.fn(() => consumedAt);

  const handler = new ConfirmPasswordRecoveryHandler({
    clock: {
      now: clockNow,
    },

    passwordHasher: {
      hash: hashPassword,
      verify: vi.fn(),
    },

    passwordResetTokenSigner: {
      deriveToken: vi.fn(),
      hashToken,
    },

    unitOfWork,
  });

  return {
    handler,
    hashPassword,
    hashToken,
    clockNow,
    transactionSpy,
  };
}

describe("ConfirmPasswordRecoveryHandler", () => {
  it("hashes the new password and consumes the token transactionally", async () => {
    const transaction = createTransaction();

    const { handler, hashPassword, hashToken, clockNow, transactionSpy } =
      createHandler(transaction);

    const result = await handler.execute(command);

    expect(result).toEqual({
      passwordReset: true,
    });

    expect(hashPassword).toHaveBeenCalledOnce();
    expect(hashPassword).toHaveBeenCalledWith(command.password);

    expect(hashToken).toHaveBeenCalledOnce();
    expect(hashToken).toHaveBeenCalledWith(bearerToken);

    expect(clockNow).toHaveBeenCalledOnce();
    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.passwordResetTokens.consume).toHaveBeenCalledOnce();
    expect(transaction.passwordResetTokens.consume).toHaveBeenCalledWith(
      tokenHash,
      consumedAt,
    );

    expect(transaction.users.updatePassword).toHaveBeenCalledOnce();
    expect(transaction.users.updatePassword).toHaveBeenCalledWith(
      userId,
      passwordHash,
      consumedAt,
    );
  });

  it("rejects an invalid, expired, or consumed token", async () => {
    const transaction = createTransaction();

    vi.mocked(transaction.passwordResetTokens.consume).mockResolvedValue(null);

    const { handler, transactionSpy } = createHandler(transaction);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      InvalidPasswordResetTokenError,
    );

    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.passwordResetTokens.consume).toHaveBeenCalledWith(
      tokenHash,
      consumedAt,
    );

    expect(transaction.users.updatePassword).not.toHaveBeenCalled();
  });

  it("rejects the reset when the user password cannot be updated", async () => {
    const transaction = createTransaction();

    vi.mocked(transaction.users.updatePassword).mockResolvedValue(false);

    const { handler } = createHandler(transaction);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      InvalidPasswordResetTokenError,
    );

    expect(transaction.passwordResetTokens.consume).toHaveBeenCalledOnce();

    expect(transaction.users.updatePassword).toHaveBeenCalledWith(
      userId,
      passwordHash,
      consumedAt,
    );
  });

  it("does not open a transaction when password hashing fails", async () => {
    const transaction = createTransaction();
    const transactionSpy = vi.fn();
    const hashingError = new Error("Password hashing failed.");

    const handler = new ConfirmPasswordRecoveryHandler({
      clock: {
        now: () => consumedAt,
      },

      passwordHasher: {
        hash: vi.fn(async () => {
          throw hashingError;
        }),
        verify: vi.fn(),
      },

      passwordResetTokenSigner: {
        deriveToken: vi.fn(),
        hashToken: vi.fn(() => tokenHash),
      },

      unitOfWork: {
        async transaction<T>(
          operation: (tx: IdentityTransaction) => Promise<T>,
        ): Promise<T> {
          transactionSpy();
          return operation(transaction);
        },
      },
    });

    await expect(handler.execute(command)).rejects.toBe(hashingError);

    expect(transactionSpy).not.toHaveBeenCalled();
    expect(transaction.passwordResetTokens.consume).not.toHaveBeenCalled();
  });
});
