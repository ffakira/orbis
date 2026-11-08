import type { UserStatus } from "#modules/identity/domain/user.js";

export interface ActiveUser {
  status: UserStatus;
  tokenVersion: number;
}

export interface ActiveUserRepository {
  findById(userId: string): Promise<ActiveUser | null>;
}
