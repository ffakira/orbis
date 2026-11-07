import { describe, expect, it } from "vitest";

import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/cryptography/argon2-password-hasher.js";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  it("hashes a plain-text password", async () => {
    const password = "synthetic-test-password";

    const passwordHash = await hasher.hash(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toBe(password);
  });

  it("verifies a correct password", async () => {
    const password = "synthetic-test-password";
    const passwordHash = await hasher.hash(password);

    await expect(hasher.verify(password, passwordHash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hasher.hash("synthetic-test-password");

    await expect(
      hasher.verify("incorrect-test-password", passwordHash),
    ).resolves.toBe(false);
  });

  it("rejects a malformed password hash", async () => {
    await expect(
      hasher.verify("synthetic-test-password", "invalid-hash"),
    ).resolves.toBe(false);
  });
});
