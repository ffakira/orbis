import type { ActiveUserRepository } from "#modules/identity/application/ports/active-user-repository.js";

export class InactiveUserError extends Error {
  constructor() {
    super("The user is not active.");
    this.name = "InactiveUserError";
  }
}

export class InvalidTokenVersionError extends Error {
  constructor() {
    super("The access token has been invalidated.");
    this.name = "InvalidTokenVersionError";
  }
}

export interface GetActiveUserHandlerDependencies {
  activeUsers: ActiveUserRepository;
}

export class GetActiveUserHandler {
  constructor(
    private readonly dependencies: GetActiveUserHandlerDependencies,
  ) {}

  async execute(userId: string, tokenVersion: number): Promise<void> {
    const user = await this.dependencies.activeUsers.findById(userId);

    if (user?.status !== "active") {
      throw new InactiveUserError();
    }

    if (user.tokenVersion !== tokenVersion) {
      throw new InvalidTokenVersionError();
    }
  }
}
