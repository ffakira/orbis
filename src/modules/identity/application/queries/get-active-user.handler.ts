import type { ActiveUserRepository } from "#modules/identity/application/ports/active-user-repository.js";

export class InactiveUserError extends Error {
  constructor() {
    super("The user is not active.");
    this.name = "InactiveUserError";
  }
}

export interface GetActiveUserHandlerDependencies {
  activeUsers: ActiveUserRepository;
}

export class GetActiveUserHandler {
  constructor(
    private readonly dependencies: GetActiveUserHandlerDependencies,
  ) {}

  async execute(userId: string): Promise<void> {
    const status = await this.dependencies.activeUsers.findStatusById(userId);

    if (status !== "active") {
      throw new InactiveUserError();
    }
  }
}
