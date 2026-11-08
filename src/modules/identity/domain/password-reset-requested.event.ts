export class PasswordResetRequested {
  readonly type = "identity.password_reset_requested.v1";

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenId: string,
    public readonly expiresAt: string,
    public readonly occurredAt: string,
  ) {}
}
