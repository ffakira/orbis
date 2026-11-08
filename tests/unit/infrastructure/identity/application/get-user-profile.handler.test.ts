import { describe, expect, it, vi } from "vitest";

import {
  GetUserProfileHandler,
  UserProfileNotFoundError,
} from "#modules/identity/application/queries/get-user-profile.handler.js";

import type {
  UserProfile,
  UserProfileRepository,
} from "#modules/identity/application/ports/user-profile-repository.js";

describe("GetUserProfileHandler", () => {
  const profile: UserProfile = {
    userId: "7d9f4e8a-2b31-4c65-9a12-8e6f0b3c5d71",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex.morgan@example.com",
    phone: "+15551234567",
    status: "active",
    createdAt: new Date("2026-01-15T10:00:00.000Z"),
  };

  function createHandler() {
    const userProfiles: UserProfileRepository = {
      findById: vi.fn(),
    };

    return {
      handler: new GetUserProfileHandler({ userProfiles }),
      userProfiles,
    };
  }

  it("returns the authenticated user's profile", async () => {
    const { handler, userProfiles } = createHandler();

    vi.mocked(userProfiles.findById).mockResolvedValue(profile);

    await expect(handler.execute(profile.userId)).resolves.toEqual(profile);

    expect(userProfiles.findById).toHaveBeenCalledOnce();
    expect(userProfiles.findById).toHaveBeenCalledWith(profile.userId);
  });

  it("throws when the authenticated user does not exist", async () => {
    const { handler, userProfiles } = createHandler();

    vi.mocked(userProfiles.findById).mockResolvedValue(null);

    await expect(handler.execute(profile.userId)).rejects.toThrow(
      UserProfileNotFoundError,
    );
  });

  it("propagates repository errors", async () => {
    const { handler, userProfiles } = createHandler();
    const error = new Error("Database unavailable.");

    vi.mocked(userProfiles.findById).mockRejectedValue(error);

    await expect(handler.execute(profile.userId)).rejects.toBe(error);
  });
});
