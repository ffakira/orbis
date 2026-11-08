import type {
  UserProfile,
  UserProfileRepository,
} from "#modules/identity/application/ports/user-profile-repository.js";

export class UserProfileNotFoundError extends Error {
  constructor() {
    super("The authenticated user was not found.");
    this.name = "UserProfileNotFoundError";
  }
}

export interface GetUserProfileHandlerDependencies {
  userProfiles: UserProfileRepository;
}

export class GetUserProfileHandler {
  constructor(
    private readonly dependencies: GetUserProfileHandlerDependencies,
  ) {}

  async execute(userId: string): Promise<UserProfile> {
    const profile = await this.dependencies.userProfiles.findById(userId);

    if (!profile) {
      throw new UserProfileNotFoundError();
    }

    return profile;
  }
}
