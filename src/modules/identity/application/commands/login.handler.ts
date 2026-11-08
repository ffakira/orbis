
import { Email } from "#modules/identity/domain/value-objects/email.js";

import type { LoginCommand } from "#modules/identity/application/commands/login.schema.js";
import type { AccessTokenIssuer } from "#modules/identity/application/ports/access-token-issuer.js";
import type { AuthenticationUserRepository } from "#modules/identity/application/ports/authentication-user-repository.js";
import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { PasswordHasher } from "#modules/identity/application/ports/password-hasher.js";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export interface LoginHandlerDependencies {
  authenticationUsers: AuthenticationUserRepository;
  passwordHasher: PasswordHasher;
  accessTokenIssuer: AccessTokenIssuer;
  clock: Clock;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
}

export class LoginHandler {
  constructor(
    private readonly dependencies: LoginHandlerDependencies,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const {
      authenticationUsers,
      passwordHasher,
      accessTokenIssuer,
      clock,
    } = this.dependencies;

    const email = Email.create(command.email);
    const user = await authenticationUsers.findByEmail(email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await passwordHasher.verify(
      command.password,
      user.passwordHash,
    );

    if (!passwordMatches || user.status !== "active") {
      throw new InvalidCredentialsError();
    }

    const issuedAt = clock.now();
    const token = await accessTokenIssuer.issue(user.userId, issuedAt);

    return {
      accessToken: token.value,
      tokenType: "Bearer",
      expiresAt: token.expiresAt.toISOString(),
    };
  }
}
