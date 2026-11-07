import { describe, expect, it } from "vitest";

import { User } from "../../../../src/modules/identity/domain/user.js";
import { Email } from "../../../../src/modules/identity/domain/value-objects/email.js";

const registeredAt = "2026-11-07T10:00:00.000Z";

function createUser() {
  return User.register({
    id: "user-123",
    eventId: "event-123",
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

  it("does not expose password hash through domain events", () => {
    const user = createUser();

    const [event] = user.pullDomainEvents();

    expect(event).toBeDefined();
    expect(event?.userId).toBe(user.id);
    expect(event?.type).toBe("identity.user_registered.v1");
    expect(event).not.toHaveProperty("passwordHash");
  });

  it("emits one registration event", () => {
    const user = createUser();

    expect(user.pullDomainEvents()).toHaveLength(1);
    expect(user.pullDomainEvents()).toHaveLength(0);
  });

  it("rejects an empty user ID", () => {
    expect(() =>
      User.register({
        id: "",
        eventId: "event-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "$argon2id$example-hash",
        registeredAt,
      }),
    ).toThrow("User ID is required.");
  });

  it("rejects an empty password hash", () => {
    expect(() =>
      User.register({
        id: "user-123",
        eventId: "event-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "",
        registeredAt,
      }),
    ).toThrow("Password hash is required.");
  });

  it("rejects an invalid registration timestamp", () => {
    expect(() =>
      User.register({
        id: "user-123",
        eventId: "event-123",
        firstName: "Test",
        lastName: "User",
        email: Email.create("test@example.com"),
        phone: "+5511999999999",
        passwordHash: "$argon2id$example-hash",
        registeredAt: "invalid-date",
      }),
    ).toThrow("Registration timestamp must be valid.");
  });
});
