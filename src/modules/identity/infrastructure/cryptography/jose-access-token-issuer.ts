import { SignJWT } from "jose";

import type {
  AccessToken,
  AccessTokenIssuer,
} from "#modules/identity/application/ports/access-token-issuer.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "orbis";
const JWT_AUDIENCE = "orbis-api";

export class JoseAccessTokenIssuer implements AccessTokenIssuer {
  private readonly secret: Uint8Array;

  constructor(secret: Uint8Array) {
    if (secret.byteLength < 32) {
      throw new Error("JWT secret must contain at least 32 bytes.");
    }

    this.secret = new Uint8Array(secret);
  }

  async issue(userId: string, issuedAt: Date): Promise<AccessToken> {
    const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
    const expiresAt = new Date(
      (issuedAtSeconds + ACCESS_TOKEN_TTL_SECONDS) * 1000,
    );

    const value = await new SignJWT({})
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setSubject(userId)
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(issuedAtSeconds + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.secret);

    return {
      value,
      expiresAt,
    };
  }
}
