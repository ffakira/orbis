import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";

import { JoseAccessTokenIssuer } from "#modules/identity/infrastructure/cryptography/jose-access-token-issuer.js";

const secret = new TextEncoder().encode(
  "synthetic-test-secret-with-at-least-32-bytes",
);

const issuedAt = new Date("2026-11-07T12:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000001";

describe("JoseAccessTokenIssuer", () => {
  it("issues a signed HS256 access token with the expected claims", async () => {
    const issuer = new JoseAccessTokenIssuer(secret);

    const token = await issuer.issue(userId, issuedAt);

    const verified = await jwtVerify(token.value, secret, {
      algorithms: ["HS256"],
      issuer: "orbis",
      audience: "orbis-api",
      currentDate: issuedAt,
    });

    expect(verified.protectedHeader).toMatchObject({
      alg: "HS256",
      typ: "JWT",
    });

    expect(verified.payload.sub).toBe(userId);
    expect(verified.payload.iss).toBe("orbis");
    expect(verified.payload.aud).toBe("orbis-api");
    expect(verified.payload.iat).toBe(Math.floor(issuedAt.getTime() / 1000));
    expect(verified.payload.exp).toBe(
      Math.floor(issuedAt.getTime() / 1000) + 900,
    );

    expect(token.expiresAt).toEqual(new Date("2026-11-07T12:15:00.000Z"));
  });

  it("rejects secrets shorter than 32 bytes", () => {
    const shortSecret = new TextEncoder().encode("too-short");

    expect(() => new JoseAccessTokenIssuer(shortSecret)).toThrow(
      "JWT secret must contain at least 32 bytes.",
    );
  });

  it("does not issue a token that can be verified with another secret", async () => {
    const issuer = new JoseAccessTokenIssuer(secret);
    const token = await issuer.issue(userId, issuedAt);

    const differentSecret = new TextEncoder().encode(
      "another-synthetic-secret-with-at-least-32-bytes",
    );

    await expect(jwtVerify(token.value, differentSecret)).rejects.toThrow();
  });
});
