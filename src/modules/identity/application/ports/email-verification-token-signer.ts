export interface EmailVerificationTokenContext {
  tokenId: string;
  userId: string;
  expiresAt: string;
}

export interface EmailVerificationTokenSigner {
  deriveToken(context: EmailVerificationTokenContext): string;
  hashToken(token: string): string;
}
