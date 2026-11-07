export interface EmailVerificationTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export class EmailVerificationToken {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}

  static create(props: EmailVerificationTokenProps): EmailVerificationToken {
    if (props.expiresAt <= props.createdAt) {
      throw new Error(
        "Email verification token expiration must be after its creation time.",
      );
    }

    return new EmailVerificationToken(
      props.id,
      props.userId,
      props.tokenHash,
      props.expiresAt,
      props.createdAt,
    );
  }
}
