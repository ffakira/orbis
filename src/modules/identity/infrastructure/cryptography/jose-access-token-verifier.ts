import { jwtVerify } from "jose";

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from "#modules/identity/application/ports/access-token-verifier.js";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "orbis";
const JWT_AUDIENCE = "orbis-api";

export class InvalidAccessTokenError extends Error {
  constructor() {
    super("The access token is invalid or has expired.");
    this.name = "InvalidAccessTokenError";
  }
}

export class JoseAccessTokenVerifier implements AccessTokenVerifier {
  private readonly secret: Uint8Array;

  constructor(secret: Uint8Array) {
    if (secret.byteLength < 32) {
      throw new Error("JWT secret must contain at least 32 bytes.");
    }

    this.secret = new Uint8Array(secret);
  }

  async verify(token: string): Promise<VerifiedAccessToken> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      if (
        typeof payload.sub !== "string" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number"
      ) {
        throw new InvalidAccessTokenError();
      }

      return {
        userId: payload.sub,
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}
