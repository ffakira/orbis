import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InvalidCredentialsError,
  LoginHandler,
} from "#modules/identity/application/commands/login.handler.js";

import type { AccessTokenIssuer } from "#modules/identity/application/ports/access-token-issuer.js";
import type { AuthenticationUserRepository } from "#modules/identity/application/ports/authentication-user-repository.js";
import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { PasswordHasher } from "#modules/identity/application/ports/password-hasher.js";

const issuedAt = new Date("2026-11-07T12:00:00.000Z");
const expiresAt = new Date("2026-11-07T12:15:00.000Z");

const user = {
  userId: "00000000-0000-4000-8000-000000000001",
  passwordHash: "synthetic-password-hash",
  status: "active" as const,
  tokenVersion: 0,
};

describe("LoginHandler", () => {
  let authenticationUsers: {
    findByEmail: ReturnType<typeof vi.fn>;
  };
  let passwordHasher: {
    hash: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
  };
  let accessTokenIssuer: {
    issue: ReturnType<typeof vi.fn>;
  };
  let clock: {
    now: ReturnType<typeof vi.fn>;
  };
  let handler: LoginHandler;

  beforeEach(() => {
    authenticationUsers = {
      findByEmail: vi.fn().mockResolvedValue(user),
    };

    passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    };

    accessTokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        value: "synthetic-access-token",
        expiresAt,
      }),
    };

    clock = {
      now: vi.fn().mockReturnValue(issuedAt),
    };

    handler = new LoginHandler({
      authenticationUsers:
        authenticationUsers as unknown as AuthenticationUserRepository,
      passwordHasher: passwordHasher as unknown as PasswordHasher,
      accessTokenIssuer: accessTokenIssuer as unknown as AccessTokenIssuer,
      clock: clock as unknown as Clock,
    });
  });

  it("authenticates an active user and issues an access token", async () => {
    const result = await handler.execute({
      email: "user@example.com",
      password: "correct-password",
    });

    expect(authenticationUsers.findByEmail).toHaveBeenCalledOnce();
    expect(passwordHasher.verify).toHaveBeenCalledWith(
      "correct-password",
      user.passwordHash,
    );
    expect(accessTokenIssuer.issue).toHaveBeenCalledWith(
      user.userId,
      user.tokenVersion,
      issuedAt,
    );

    expect(result).toEqual({
      accessToken: "synthetic-access-token",
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
    });
  });

  it("rejects an unknown email", async () => {
    authenticationUsers.findByEmail.mockResolvedValue(null);

    await expect(
      handler.execute({
        email: "unknown@example.com",
        password: "correct-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(accessTokenIssuer.issue).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password", async () => {
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      handler.execute({
        email: "user@example.com",
        password: "incorrect-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(accessTokenIssuer.issue).not.toHaveBeenCalled();
  });

  it("rejects users pending email verification", async () => {
    authenticationUsers.findByEmail.mockResolvedValue({
      ...user,
      status: "pending_email_verification",
    });

    await expect(
      handler.execute({
        email: "user@example.com",
        password: "correct-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(accessTokenIssuer.issue).not.toHaveBeenCalled();
  });

  it("rejects suspended users", async () => {
    authenticationUsers.findByEmail.mockResolvedValue({
      ...user,
      status: "suspended",
    });

    await expect(
      handler.execute({
        email: "user@example.com",
        password: "correct-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(accessTokenIssuer.issue).not.toHaveBeenCalled();
  });

  it("propagates access token issuer failures", async () => {
    accessTokenIssuer.issue.mockRejectedValue(
      new Error("Token signing failed."),
    );

    await expect(
      handler.execute({
        email: "user@example.com",
        password: "correct-password",
      }),
    ).rejects.toThrow("Token signing failed.");
  });
});
