export interface VerifiedAccessToken {
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<VerifiedAccessToken>;
}
