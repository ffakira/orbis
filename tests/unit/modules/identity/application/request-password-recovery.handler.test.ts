import { describe, expect, it, vi } from "vitest";

import { RequestPasswordRecoveryHandler } from "#modules/identity/application/commands/request-password-recovery.handler.js";

import type { IdentityTransaction } from "#modules/identity/application/ports/unit-of-work.js";

const requestedAt = new Date("2026-11-08T12:00:00.000Z");
const userId = "user-123";
const bearerToken = "synthetic-password-reset-token";
const tokenHash = "a".repeat(64);

function createTransaction(
  user: {
    userId: string;
    passwordHash: string;
    status: "active" | "pending_email_verification" | "suspended";
  } | null,
) {
  const insertedTokens: unknown[] = [];
  const appendedEvents: unknown[] = [];

  const transaction: IdentityTransaction = {
    users: {
      insert: vi.fn(async () => {}),
      activate: vi.fn(async () => true),
      updatePassword: vi.fn(async () => true),
    },

    authenticationUsers: {
      findByEmail: vi.fn(async () => user),
    },

    termsAcceptances: {
      insert: vi.fn(async () => {}),
    },

    emailVerificationTokens: {
      insert: vi.fn(async () => {}),
      consume: vi.fn(async () => null),
    },

    passwordResetTokens: {
      insert: vi.fn(async (token) => {
        insertedTokens.push(token);
      }),
      consume: vi.fn(async () => null),
    },

    outbox: {
      append: vi.fn(async (event) => {
        appendedEvents.push(event);
      }),
    },
  };

  return {
    transaction,
    insertedTokens,
    appendedEvents,
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

  const deriveToken = vi.fn(() => bearerToken);
  const hashToken = vi.fn(() => tokenHash);
  const clockNow = vi.fn(() => requestedAt);

  let idIndex = 0;
  const ids = ["reset-token-123", "reset-event-123"];

  const handler = new RequestPasswordRecoveryHandler({
    ids: {
      generate: () => ids[idIndex++] ?? "unexpected-id",
    },

    clock: {
      now: clockNow,
    },

    passwordResetTokenSigner: {
      deriveToken,
      hashToken,
    },

    unitOfWork,
  });

  return {
    handler,
    deriveToken,
    hashToken,
    clockNow,
    transactionSpy,
  };
}

describe("RequestPasswordRecoveryHandler", () => {
  it("creates a reset token and appends an event for an active user", async () => {
    const { transaction, insertedTokens, appendedEvents } = createTransaction({
      userId,
      passwordHash: "$argon2id$synthetic-hash",
      status: "active",
    });

    const { handler, deriveToken, hashToken, clockNow, transactionSpy } =
      createHandler(transaction);

    const result = await handler.execute({
      email: "test@example.com",
    });

    expect(result).toEqual({
      requested: true,
    });

    expect(clockNow).toHaveBeenCalledOnce();
    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.authenticationUsers.findByEmail).toHaveBeenCalledOnce();
    expect(transaction.authenticationUsers.findByEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "test@example.com",
      }),
    );

    expect(deriveToken).toHaveBeenCalledWith({
      tokenId: "reset-token-123",
      userId,
      expiresAt: "2026-11-08T13:00:00.000Z",
    });

    expect(hashToken).toHaveBeenCalledWith(bearerToken);

    expect(insertedTokens).toHaveLength(1);
    expect(appendedEvents).toHaveLength(1);

    expect(transaction.passwordResetTokens.insert).toHaveBeenCalledOnce();
    expect(transaction.outbox.append).toHaveBeenCalledOnce();

    expect(insertedTokens[0]).toMatchObject({
      id: "reset-token-123",
      userId,
      tokenHash,
      createdAt: requestedAt,
      expiresAt: new Date("2026-11-08T13:00:00.000Z"),
    });

    expect(appendedEvents[0]).toMatchObject({
      id: "reset-event-123",
      type: "identity.password_reset_requested.v1",
      userId,
      tokenId: "reset-token-123",
      expiresAt: "2026-11-08T13:00:00.000Z",
      occurredAt: requestedAt.toISOString(),
    });

    expect(JSON.stringify(insertedTokens)).not.toContain(bearerToken);
    expect(JSON.stringify(appendedEvents)).not.toContain(bearerToken);
  });

  it.each([
    ["unknown user", null],
    [
      "pending user",
      {
        userId,
        passwordHash: "$argon2id$synthetic-hash",
        status: "pending_email_verification" as const,
      },
    ],
    [
      "suspended user",
      {
        userId,
        passwordHash: "$argon2id$synthetic-hash",
        status: "suspended" as const,
      },
    ],
  ])("returns the same result for an %s", async (_description, user) => {
    const { transaction, insertedTokens, appendedEvents } =
      createTransaction(user);

    const { handler, deriveToken, hashToken } = createHandler(transaction);

    const result = await handler.execute({
      email: "test@example.com",
    });

    expect(result).toEqual({
      requested: true,
    });

    expect(insertedTokens).toHaveLength(0);
    expect(appendedEvents).toHaveLength(0);

    expect(transaction.passwordResetTokens.insert).not.toHaveBeenCalled();
    expect(transaction.outbox.append).not.toHaveBeenCalled();

    expect(deriveToken).not.toHaveBeenCalled();
    expect(hashToken).not.toHaveBeenCalled();
  });

  it("does not return success when the transaction fails", async () => {
    const transactionError = new Error("Database transaction failed.");

    const unitOfWork = {
      async transaction<T>(
        _operation: (tx: IdentityTransaction) => Promise<T>,
      ): Promise<T> {
        throw transactionError;
      },
    };

    const handler = new RequestPasswordRecoveryHandler({
      ids: {
        generate: () => "synthetic-id",
      },

      clock: {
        now: () => requestedAt,
      },

      passwordResetTokenSigner: {
        deriveToken: vi.fn(() => bearerToken),
        hashToken: vi.fn(() => tokenHash),
      },

      unitOfWork,
    });

    await expect(
      handler.execute({
        email: "test@example.com",
      }),
    ).rejects.toBe(transactionError);
  });
});
