import {
  registerUserSchema,
  type RegisterUserProps,
} from "#modules/identity/domain/user.schema.js";
import { Email } from "#modules/identity/domain/value-objects/email.js";

export type UserStatus = "pending_email_verification" | "active" | "suspended";

export class User {
  private constructor(
    public readonly id: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: Email,
    public readonly phone: string,
    private readonly passwordHashValue: string,
    public readonly status: UserStatus,
    public readonly createdAt: string,
    public readonly updatedAt: string,
  ) {}

  static register(props: RegisterUserProps): User {
    const validated = registerUserSchema.parse(props);

    return new User(
      validated.id,
      validated.firstName,
      validated.lastName,
      validated.email,
      validated.phone,
      validated.passwordHash,
      "pending_email_verification",
      validated.registeredAt,
      validated.registeredAt,
    );
  }

  get passwordHash(): string {
    return this.passwordHashValue;
  }
}
