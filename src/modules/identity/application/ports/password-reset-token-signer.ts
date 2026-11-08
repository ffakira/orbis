export interface PasswordResetTokenContext {
  tokenId: string;
  userId: string;
  expiresAt: string;
}

export interface PasswordResetTokenSigner {
  deriveToken(context: PasswordResetTokenContext): string;
  hashToken(token: string): string;
}
