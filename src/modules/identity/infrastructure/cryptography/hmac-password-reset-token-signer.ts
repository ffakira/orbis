import { createHash, createHmac } from "node:crypto";

import type {
  PasswordResetTokenContext,
  PasswordResetTokenSigner,
} from "#modules/identity/application/ports/password-reset-token-signer.js";

const TOKEN_CONTEXT = "orbis.password-reset.v1";

export class HmacPasswordResetTokenSigner implements PasswordResetTokenSigner {
  private readonly secret: Buffer;

  constructor(secret: Uint8Array) {
    if (secret.byteLength < 32) {
      throw new Error("Password reset secret must contain at least 32 bytes.");
    }

    this.secret = Buffer.from(secret);
  }

  deriveToken(context: PasswordResetTokenContext): string {
    const message = [
      TOKEN_CONTEXT,
      context.tokenId,
      context.userId,
      context.expiresAt,
    ].join("\n");

    return createHmac("sha256", this.secret)
      .update(message, "utf8")
      .digest("base64url");
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }
}
