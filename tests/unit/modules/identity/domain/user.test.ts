import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { User } from "#modules/identity/domain/user.js";
import { Email } from "#modules/identity/domain/value-objects/email.js";

const registeredAt = "2026-11-07T10:00:00.000Z";

function createUser() {
  return User.register({
    id: "user-123",
    firstName: "Test",
    lastName: "User",
    email: Email.create("test@example.com"),
    phone: "+5511999999999",
    passwordHash: "$argon2id$example-hash",
    registeredAt,
  });
}

describe("User", () => {
  it("registers a user with pending email verification", () => {
    const user = createUser();

    expect(user.id).toBe("user-123");
    expect(user.firstName).toBe("Test");
    expect(user.lastName).toBe("User");
    expect(user.email.value).toBe("test@example.com");
    expect(user.status).toBe("pending_email_verification");
  });

  it("uses the registration timestamp for creation and update", () => {
    const user = createUser();

    expect(user.createdAt).toBe(registeredAt);
    expect(user.updatedAt).toBe(registeredAt);
  });

  it("exposes the password hash through its persistence accessor", () => {
    const user = createUser();

    expect(user.passwordHash).toBe("$argon2id$example-hash");
  });

  it("rejects an empty user ID", () => {
    expect(() =>
      User.register({
        id: "",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "$argon2id$example-hash",
        registeredAt,
      }),
    ).toThrow(ZodError);

    try {
      User.register({
        id: "",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "$argon2id$example-hash",
        registeredAt,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect((error as ZodError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["id"],
            code: "too_small",
          }),
        ]),
      );
    }
  });

  it("rejects an empty password hash", () => {
    expect(() =>
      User.register({
        id: "user-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "",
        registeredAt,
      }),
    ).toThrow(ZodError);

    try {
      User.register({
        id: "user-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "",
        registeredAt,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect((error as ZodError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["passwordHash"],
            code: "too_small",
          }),
        ]),
      );
    }
  });

  it("rejects an invalid registration timestamp", () => {
    expect(() =>
      User.register({
        id: "user-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "$argon2id$example-hash",
        registeredAt: "invalid-date",
      }),
    ).toThrow(ZodError);

    try {
      User.register({
        id: "user-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "$argon2id$example-hash",
        registeredAt: "invalid-date",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect((error as ZodError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["registeredAt"],
            code: "invalid_format",
          }),
        ]),
      );
    }
  });
});
