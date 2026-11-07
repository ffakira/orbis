import { describe, expect, it, vi } from "vitest";

import { RegisterUserHandler } from "../../../../src/modules/identity/application/commands/register-user.handler.js";

import type { RegisterUserCommand } from "../../../../src/modules/identity/application/commands/register-user.schema.js";
import type { IdentityTransaction } from "../../../../src/modules/identity/application/ports/unit-of-work.js";

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
  it("registers a user and records terms acceptance transactionally", async () => {
    const insertedUsers: unknown[] = [];
    const insertedAcceptances: unknown[] = [];
    const appendedEvents: unknown[] = [];

    const ids = ["user-123", "event-123", "acceptance-123"];

    let idIndex = 0;

    const transaction: IdentityTransaction = {
      users: {
        insert: vi.fn(async (user) => {
          insertedUsers.push(user);
        }),
      },

      termsAcceptances: {
        insert: vi.fn(async (acceptance) => {
          insertedAcceptances.push(acceptance);
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
      },

      termsPolicy: {
        currentTermsOfServiceVersion: () => "2026-11-01",
      },

      unitOfWork,
    });

    const result = await handler.execute(command);

    expect(result).toEqual({
      userId: "user-123",
    });

    expect(insertedUsers).toHaveLength(1);
    expect(insertedAcceptances).toHaveLength(1);
    expect(appendedEvents).toHaveLength(1);

    expect(transactionSpy).toHaveBeenCalledOnce();

    expect(transaction.users.insert).toHaveBeenCalledOnce();
    expect(transaction.termsAcceptances.insert).toHaveBeenCalledOnce();
    expect(transaction.outbox.append).toHaveBeenCalledOnce();
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
      },

      termsPolicy: {
        currentTermsOfServiceVersion: () => "2026-11-01",
      },

      unitOfWork,
    });

    await expect(handler.execute(command)).rejects.toThrow("Hashing failed.");

    expect(transactionSpy).not.toHaveBeenCalled();
  });
});
