export interface AccessToken {
  value: string;
  expiresAt: Date;
}

export interface AccessTokenIssuer {
  issue(
    userId: string,
    tokenVersion: number,
    issuedAt: Date,
  ): Promise<AccessToken>;
}
