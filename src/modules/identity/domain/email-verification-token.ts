import {
  emailVerificationTokenSchema,
  type IssueEmailVerificationTokenProps,
} from "./email-verification-token.schema.js";

export class EmailVerificationToken {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: string,
    public readonly createdAt: string,
  ) {}

  static issue(
    props: IssueEmailVerificationTokenProps,
  ): EmailVerificationToken {
    const validated = emailVerificationTokenSchema.parse(props);

    return new EmailVerificationToken(
      validated.id,
      validated.userId,
      validated.tokenHash,
      validated.expiresAt,
      validated.createdAt,
    );
  }
}
