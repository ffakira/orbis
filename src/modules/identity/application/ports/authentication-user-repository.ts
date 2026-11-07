import type { UserStatus } from "#modules/identity/domain/user.js";
import type { Email } from "#modules/identity/domain/value-objects/email.js";

export interface AuthenticationUser {
  userId: string;
  passwordHash: string;
  status: UserStatus;
}

export interface AuthenticationUserRepository {
  findByEmail(email: Email): Promise<AuthenticationUser | null>;
}
