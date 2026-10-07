import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());

vi.mock("../http", () => ({
  http: {
    get,
    post,
  },
}));

import { wingmanApi } from "./wingman";

describe("wingmanApi Duo discovery", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("requests a cursor-safe discovery page", async () => {
    get.mockResolvedValue({ items: [] });

    await wingmanApi.discover("next-page", 8);

    expect(get).toHaveBeenCalledWith("wingman/discovery", {
      cursor: "next-page",
      limit: 8,
    });
  });

  it("sends an individual private vote for one target Duo", async () => {
    post.mockResolvedValue({ outcome: "VOTE_RECORDED" });

    await wingmanApi.vote("target-party", "APPROVE");

    expect(post).toHaveBeenCalledWith(
      "wingman/discovery/target-party/vote",
      { decision: "APPROVE" },
    );
  });
});
