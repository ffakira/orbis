export interface EmailVerificationRequestedProps {
  id: string;
  userId: string;
  tokenId: string;
  expiresAt: string;
  occurredAt: string;
}

export class EmailVerificationRequested {
  readonly type = "identity.email_verification_requested.v1";

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenId: string,
    public readonly expiresAt: string,
    public readonly occurredAt: string,
  ) {}
}
