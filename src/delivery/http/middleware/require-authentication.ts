import type { RequestHandler } from "express";

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from "#modules/identity/application/ports/access-token-verifier.js";

import { InvalidAccessTokenError } from "#modules/identity/infrastructure/cryptography/jose-access-token-verifier.js";

export interface AuthenticationMiddlewareDependencies {
  getAccessTokenVerifier: () => Promise<AccessTokenVerifier>;
}

export interface AuthenticatedLocals {
  auth: VerifiedAccessToken;
}

export function createRequireAuthentication(
  dependencies: AuthenticationMiddlewareDependencies,
): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.get("authorization");

    if (!authorization) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "Authentication is required.",
      });
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!match?.[1]) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "Authentication is required.",
      });
    }

    try {
      const verifier = await dependencies.getAccessTokenVerifier();
      const authenticatedUser = await verifier.verify(match[1]);

      res.locals.auth = authenticatedUser;

      return next();
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        return res.status(401).json({
          error: "UNAUTHENTICATED",
          message: "Authentication is required.",
        });
      }

      return next(error);
    }
  };
}
