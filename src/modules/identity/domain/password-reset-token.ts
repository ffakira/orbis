export interface PasswordResetTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export class PasswordResetToken {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}

  static create(props: PasswordResetTokenProps): PasswordResetToken {
    if (props.expiresAt <= props.createdAt) {
      throw new Error(
        "Password reset token expiration must be after its creation time.",
      );
    }

    return new PasswordResetToken(
      props.id,
      props.userId,
      props.tokenHash,
      props.expiresAt,
      props.createdAt,
    );
  }
}
