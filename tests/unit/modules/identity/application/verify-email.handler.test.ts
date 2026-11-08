import { describe, expect, it, vi } from "vitest";

import { VerifyEmailHandler } from "#modules/identity/application/commands/verify-email.handler.js";
import { InvalidEmailVerificationTokenError } from "#modules/identity/application/invalid-email-verification-token.error.js";

import type { IdentityTransaction } from "#modules/identity/application/ports/unit-of-work.js";

const bearerToken = "synthetic-verification-token";
const tokenHash = "a".repeat(64);
const userId = "user-123";
const consumedAt = new Date("2026-11-07T12:00:00.000Z");

function createTransaction(): IdentityTransaction {
  return {
    users: {
      insert: vi.fn(async () => {}),
      activate: vi.fn(async () => true),
    },

    authenticationUsers: {
      findByEmail: vi.fn(async () => null),
    },

    termsAcceptances: {
      insert: vi.fn(async () => {}),
    },

    emailVerificationTokens: {
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

  const hashToken = vi.fn(() => tokenHash);
  const clockNow = vi.fn(() => consumedAt);

  const handler = new VerifyEmailHandler({
    clock: {
      now: clockNow,
    },

    emailVerificationTokenSigner: {
      deriveToken: vi.fn(),
      hashToken,
    },

    unitOfWork,
  });

  return {
    handler,
    hashToken,
    clockNow,
    transactionSpy,
  };
}

describe("VerifyEmailHandler", () => {
  it("consumes the token and activates the user transactionally", async () => {
    const transaction = createTransaction();

    const { handler, hashToken, clockNow, transactionSpy } =
      createHandler(transaction);

    const result = await handler.execute({
      token: bearerToken,
    });

    expect(result).toEqual({
      verified: true,
    });

    expect(hashToken).toHaveBeenCalledOnce();
    expect(hashToken).toHaveBeenCalledWith(bearerToken);

    expect(clockNow).toHaveBeenCalledOnce();

    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.emailVerificationTokens.consume).toHaveBeenCalledOnce();

    expect(transaction.emailVerificationTokens.consume).toHaveBeenCalledWith(
      tokenHash,
      consumedAt,
    );

    expect(transaction.users.activate).toHaveBeenCalledOnce();

    expect(transaction.users.activate).toHaveBeenCalledWith(userId, consumedAt);
  });

  it("rejects an invalid, expired, revoked, or consumed token", async () => {
    const transaction = createTransaction();

    vi.mocked(transaction.emailVerificationTokens.consume).mockResolvedValue(
      null,
    );

    const { handler, transactionSpy } = createHandler(transaction);

    await expect(
      handler.execute({
        token: bearerToken,
      }),
    ).rejects.toBeInstanceOf(InvalidEmailVerificationTokenError);

    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.emailVerificationTokens.consume).toHaveBeenCalledWith(
      tokenHash,
      consumedAt,
    );

    expect(transaction.users.activate).not.toHaveBeenCalled();
  });

  it("rejects verification when the user cannot be activated", async () => {
    const transaction = createTransaction();

    vi.mocked(transaction.users.activate).mockResolvedValue(false);

    const { handler, transactionSpy } = createHandler(transaction);

    await expect(
      handler.execute({
        token: bearerToken,
      }),
    ).rejects.toBeInstanceOf(InvalidEmailVerificationTokenError);

    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.emailVerificationTokens.consume).toHaveBeenCalledWith(
      tokenHash,
      consumedAt,
    );

    expect(transaction.users.activate).toHaveBeenCalledWith(userId, consumedAt);
  });

  it("does not return success when the transaction fails", async () => {
    const transaction = createTransaction();

    const transactionError = new Error("Database transaction failed.");

    const unitOfWork = {
      async transaction<T>(
        _operation: (tx: IdentityTransaction) => Promise<T>,
      ): Promise<T> {
        throw transactionError;
      },
    };

    const handler = new VerifyEmailHandler({
      clock: {
        now: () => consumedAt,
      },

      emailVerificationTokenSigner: {
        deriveToken: vi.fn(),
        hashToken: vi.fn(() => tokenHash),
      },

      unitOfWork,
    });

    await expect(
      handler.execute({
        token: bearerToken,
      }),
    ).rejects.toBe(transactionError);

    expect(transaction.users.activate).not.toHaveBeenCalled();
  });
});
