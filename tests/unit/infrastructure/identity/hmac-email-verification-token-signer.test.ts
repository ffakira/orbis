import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { HmacEmailVerificationTokenSigner } from "../../../../src/modules/identity/infrastructure/cryptography/hmac-email-verification-token-signer.js";

const secret = Buffer.from(
  "synthetic-email-verification-secret-with-32-bytes-minimum",
  "utf8",
);

const context = {
  tokenId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  expiresAt: "2026-11-08T12:00:00.000Z",
};

describe("HmacEmailVerificationTokenSigner", () => {
  const signer = new HmacEmailVerificationTokenSigner(secret);

  it("rejects secrets shorter than 32 bytes", () => {
    expect(
      () => new HmacEmailVerificationTokenSigner(Buffer.alloc(31)),
    ).toThrow("Email verification secret must contain at least 32 bytes.");
  });

  it("derives a deterministic bearer token from the context", () => {
    const first = signer.deriveToken(context);
    const second = signer.deriveToken(context);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("matches the expected HMAC-SHA256 derivation", () => {
    const message = [
      "orbis.email-verification.v1",
      context.tokenId,
      context.userId,
      context.expiresAt,
    ].join("\n");

    const expected = createHmac("sha256", secret)
      .update(message, "utf8")
      .digest("base64url");

    expect(signer.deriveToken(context)).toBe(expected);
  });

  it("derives different tokens for different token IDs", () => {
    const first = signer.deriveToken(context);

    const second = signer.deriveToken({
      ...context,
      tokenId: "00000000-0000-4000-8000-000000000003",
    });

    expect(first).not.toBe(second);
  });

  it("derives different tokens for different user IDs", () => {
    const first = signer.deriveToken(context);

    const second = signer.deriveToken({
      ...context,
      userId: "00000000-0000-4000-8000-000000000004",
    });

    expect(first).not.toBe(second);
  });

  it("derives different tokens for different expiration times", () => {
    const first = signer.deriveToken(context);

    const second = signer.deriveToken({
      ...context,
      expiresAt: "2026-11-09T12:00:00.000Z",
    });

    expect(first).not.toBe(second);
  });

  it("hashes bearer tokens using SHA-256 hexadecimal encoding", () => {
    const bearerToken = signer.deriveToken(context);

    const expected = createHash("sha256")
      .update(bearerToken, "utf8")
      .digest("hex");

    const hash = signer.hashToken(bearerToken);

    expect(hash).toBe(expected);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(bearerToken);
  });

  it("produces different hashes for different bearer tokens", () => {
    const first = signer.hashToken("synthetic-token-one");
    const second = signer.hashToken("synthetic-token-two");

    expect(first).not.toBe(second);
  });
});
