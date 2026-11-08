import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  InvalidAccessTokenError,
  JoseAccessTokenVerifier,
} from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";

const secret = new TextEncoder().encode(
  "synthetic-test-secret-with-at-least-32-bytes",
);

const issuedAt = new Date("2026-11-07T12:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000001";

async function createToken(
  signingSecret: Uint8Array = secret,
  options: {
    issuer?: string;
    audience?: string;
    subject?: string;
    issuedAt?: number;
    expiresAt?: number;
  } = {},
): Promise<string> {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(options.issuer ?? "orbis")
    .setAudience(options.audience ?? "orbis-api")
    .setSubject(options.subject ?? userId)
    .setIssuedAt(options.issuedAt ?? issuedAtSeconds)
    .setExpirationTime(options.expiresAt ?? issuedAtSeconds + 900)
    .sign(signingSecret);
}

describe("JoseAccessTokenVerifier", () => {
  it("verifies a valid access token and returns its claims", async () => {
    const verifier = new JoseAccessTokenVerifier(secret);

    const now = Math.floor(Date.now() / 1000);
    const token = await createToken(secret, {
      issuedAt: now,
      expiresAt: now + 900,
    });

    const result = await verifier.verify(token);

    expect(result).toEqual({
      userId,
      issuedAt: new Date(now * 1000),
      expiresAt: new Date((now + 900) * 1000),
    });
  });

  it("rejects secrets shorter than 32 bytes", () => {
    const shortSecret = new TextEncoder().encode("too-short");

    expect(() => new JoseAccessTokenVerifier(shortSecret)).toThrow(
      "JWT secret must contain at least 32 bytes.",
    );
  });

  it("rejects tokens signed with another secret", async () => {
    const verifier = new JoseAccessTokenVerifier(secret);

    const differentSecret = new TextEncoder().encode(
      "another-synthetic-secret-with-at-least-32-bytes",
    );

    const token = await createToken(differentSecret);

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it("rejects expired tokens", async () => {
    const verifier = new JoseAccessTokenVerifier(secret);

    const token = await createToken(secret, {
      expiresAt: Math.floor(issuedAt.getTime() / 1000) - 1,
    });

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it("rejects an incorrect issuer", async () => {
    const verifier = new JoseAccessTokenVerifier(secret);

    const token = await createToken(secret, {
      issuer: "another-application",
    });

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it("rejects an incorrect audience", async () => {
    const verifier = new JoseAccessTokenVerifier(secret);

    const token = await createToken(secret, {
      audience: "another-api",
    });

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it("rejects malformed tokens", async () => {
    const verifier = new JoseAccessTokenVerifier(secret);

    await expect(verifier.verify("not-a-valid-jwt")).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
