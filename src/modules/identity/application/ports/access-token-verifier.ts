export interface VerifiedAccessToken {
  userId: string;
  tokenVersion: number;
  issuedAt: Date;
  expiresAt: Date;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<VerifiedAccessToken>;
}
