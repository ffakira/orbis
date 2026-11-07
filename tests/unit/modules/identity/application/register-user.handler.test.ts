
import { describe, expect, it, vi } from "vitest";

import { RegisterUserHandler } from "../../../../../src/modules/identity/application/commands/register-user.handler.js";

import type { RegisterUserCommand } from "../../../../../src/modules/identity/application/commands/register-user.schema.js";
import type { IdentityTransaction } from "../../../../../src/modules/identity/application/ports/unit-of-work.js";

const registeredAt = "2026-11-07T10:00:00.000Z";

const command: RegisterUserCommand = {
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "+5511999999999",
  password: "synthetic-test-password",
  acceptTerms: true,
};

describe("RegisterUserHandler", () => {
  it("registers a user and issues an email verification token transactionally", async () => {
    const insertedUsers: unknown[] = [];
    const insertedAcceptances: unknown[] = [];
    const insertedTokens: unknown[] = [];
    const appendedEvents: unknown[] = [];

    const ids = [
      "user-123",
      "registration-event-123",
      "acceptance-123",
      "verification-token-123",
      "verification-event-123",
    ];

    let idIndex = 0;

    const deriveToken = vi.fn(() => "synthetic-bearer-token");
    const hashToken = vi.fn(() => "a".repeat(64));

    const transaction: IdentityTransaction = {
      users: {
        insert: vi.fn(async (user) => {
          insertedUsers.push(user);
        }),
      },

      authenticationUsers: {
        findByEmail: vi.fn(async () => null),
      },

      termsAcceptances: {
        insert: vi.fn(async (acceptance) => {
          insertedAcceptances.push(acceptance);
        }),
      },

      emailVerificationTokens: {
        insert: vi.fn(async (token) => {
          insertedTokens.push(token);
        }),
      },

      outbox: {
        append: vi.fn(async (event) => {
          appendedEvents.push(event);
        }),
      },
    };

    const transactionSpy = vi.fn();

    const unitOfWork = {
      async transaction<T>(
        operation: (tx: IdentityTransaction) => Promise<T>,
      ): Promise<T> {
        transactionSpy();

        return operation(transaction);
      },
    };

    const handler = new RegisterUserHandler({
      ids: {
        generate: () => ids[idIndex++] ?? "unexpected-id",
      },

      clock: {
        now: () => new Date(registeredAt),
      },

      passwordHasher: {
        hash: vi.fn(async () => "$argon2id$synthetic-hash"),
        verify: vi.fn(async () => true),
      },

      termsPolicy: {
        currentTermsOfServiceVersion: () => "2026-11-01",
      },

      emailVerificationTokenSigner: {
        deriveToken,
        hashToken,
      },

      unitOfWork,
    });

    const result = await handler.execute(command);

    expect(result).toEqual({
      userId: "user-123",
    });

    expect(insertedUsers).toHaveLength(1);
    expect(insertedAcceptances).toHaveLength(1);
    expect(insertedTokens).toHaveLength(1);
    expect(appendedEvents).toHaveLength(2);

    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.users.insert).toHaveBeenCalledOnce();
    expect(transaction.termsAcceptances.insert).toHaveBeenCalledOnce();
    expect(transaction.emailVerificationTokens.insert).toHaveBeenCalledOnce();
    expect(transaction.outbox.append).toHaveBeenCalledTimes(2);

    expect(deriveToken).toHaveBeenCalledWith({
      tokenId: "verification-token-123",
      userId: "user-123",
      expiresAt: "2026-11-08T10:00:00.000Z",
    });

    expect(hashToken).toHaveBeenCalledWith("synthetic-bearer-token");

    const persistedToken = insertedTokens[0] as {
      id: string;
      userId: string;
      tokenHash: string;
      createdAt: Date;
      expiresAt: Date;
    };

    expect(persistedToken.id).toBe("verification-token-123");
    expect(persistedToken.userId).toBe("user-123");
    expect(persistedToken.tokenHash).toBe("a".repeat(64));
    expect(persistedToken.createdAt).toEqual(new Date(registeredAt));
    expect(persistedToken.expiresAt).toEqual(
      new Date("2026-11-08T10:00:00.000Z"),
    );

    const verificationEvent = appendedEvents.find(
      (event) =>
        typeof event === "object" &&
        event !== null &&
        "tokenId" in event,
    ) as {
      type: string;
      userId: string;
      tokenId: string;
      expiresAt: string;
    } | undefined;

    expect(verificationEvent).toMatchObject({
      type: "identity.email_verification_requested.v1",
      userId: "user-123",
      tokenId: "verification-token-123",
      expiresAt: "2026-11-08T10:00:00.000Z",
    });

    // The raw bearer token must not be persisted or included in the event.
    expect(JSON.stringify(insertedTokens)).not.toContain(
      "synthetic-bearer-token",
    );
    expect(JSON.stringify(appendedEvents)).not.toContain(
      "synthetic-bearer-token",
    );
  });

  it("does not persist anything when password hashing fails", async () => {
    const transactionSpy = vi.fn();

    const unitOfWork = {
      async transaction<T>(
        _operation: (tx: IdentityTransaction) => Promise<T>,
      ): Promise<T> {
        transactionSpy();

        throw new Error("Transaction should not be reached.");
      },
    };

    const handler = new RegisterUserHandler({
      ids: {
        generate: () => "synthetic-id",
      },

      clock: {
        now: () => new Date(registeredAt),
      },

      passwordHasher: {
        hash: vi.fn(async () => {
          throw new Error("Hashing failed.");
        }),
        verify: vi.fn(async () => false),
      },

      termsPolicy: {
        currentTermsOfServiceVersion: () => "2026-11-01",
      },

      emailVerificationTokenSigner: {
        deriveToken: vi.fn(),
        hashToken: vi.fn(),
      },

      unitOfWork,
    });

    await expect(handler.execute(command)).rejects.toThrow("Hashing failed.");

    expect(transactionSpy).not.toHaveBeenCalled();
  });
});
