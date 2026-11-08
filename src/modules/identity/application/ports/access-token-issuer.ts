export interface AccessToken {
  value: string;
  expiresAt: Date;
}

export interface AccessTokenIssuer {
  issue(userId: string, issuedAt: Date): Promise<AccessToken>;
}
