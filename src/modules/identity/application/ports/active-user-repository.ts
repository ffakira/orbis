import type { UserStatus } from "#modules/identity/domain/user.js";

export interface ActiveUserRepository {
  findStatusById(userId: string): Promise<UserStatus | null>;
}
