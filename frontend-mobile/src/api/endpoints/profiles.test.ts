import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());

vi.mock("../http", () => ({
  http: {
    get,
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { profilesApi } from "./profiles";

describe("profilesApi.publicById", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("loads and unwraps one authorized public profile by id", async () => {
    const profile = { userId: "11111111-1111-1111-1111-111111111111" };
    get.mockResolvedValue({ profile });

    await expect(profilesApi.publicById(profile.userId)).resolves.toBe(profile);
    expect(get).toHaveBeenCalledWith(`profiles/${profile.userId}`);
  });
});
