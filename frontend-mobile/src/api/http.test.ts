import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeApiErrorBody } from "./errors";
import { configureHttpClient, http } from "./http";

vi.mock("../dev/fixtureRouter", () => ({ isFixturesEnabled: () => false }));
vi.mock("../utils/env", () => ({ env: { apiBaseUrl: "http://localhost" } }));

afterEach(() => {
  vi.unstubAllGlobals();
  configureHttpClient({ getSessionVersion: () => 0 });
});

describe("HTTP token refresh", () => {
  const unauthorized = () => new Response(JSON.stringify({
    code: "UNAUTHORIZED", message: "Expired token", requestId: "test",
  }), { status: 401 });

  it("retries with the refreshed token before the token provider updates", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(new Response('{"uploaded":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const refresh = vi.fn().mockResolvedValue("new-token");
    const onUnauthenticated = vi.fn();
    configureHttpClient({
      getAccessToken: async () => "stale-token", refresh, onUnauthenticated,
    });

    await expect(http.post("/profiles/photos/upload", { mimeType: "image/png" }))
      .resolves.toEqual({ uploaded: true });
    expect(fetchMock.mock.calls.map(([, options]) => options.headers.Authorization))
      .toEqual(["Bearer stale-token", "Bearer new-token"]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("shares a refresh across concurrent requests and retries both with its token", async () => {
    let finishRefresh!: (token: string) => void;
    const refresh = vi.fn(() => new Promise<string>(resolve => { finishRefresh = resolve; }));
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) =>
      (options.headers as Record<string, string>).Authorization === "Bearer new-token"
        ? new Response('{"ok":true}') : unauthorized());
    vi.stubGlobal("fetch", fetchMock);
    configureHttpClient({ getAccessToken: async () => "stale-token", refresh });

    const requests = [http.get("/calls/pending"), http.get("/profiles/me")];
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    finishRefresh("new-token");
    await expect(Promise.all(requests)).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([200, 401])("discards a previous account's delayed %s response", async status => {
    let version = 1;
    let finish!: (response: Response) => void;
    const refresh = vi.fn();
    const onUnauthenticated = vi.fn();
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    configureHttpClient({ getAccessToken: async () => "account-a", getSessionVersion: () => version, refresh, onUnauthenticated });
    const result = http.get("/private-stories/feed");
    const rejected = expect(result).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    version += 1;
    finish(status === 401 ? unauthorized() : new Response('{"private":"account-a"}'));
    await rejected;
    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("does not replay or sign out the new account when an older refresh completes", async () => {
    let version = 1;
    let finish!: (token: string | null) => void;
    const refresh = vi.fn(() => new Promise<string | null>(resolve => { finish = resolve; }));
    const onUnauthenticated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal("fetch", fetchMock);
    configureHttpClient({ getAccessToken: async () => "account-a", getSessionVersion: () => version, refresh, onUnauthenticated });
    const result = http.get("/private-stories/feed");
    const rejected = expect(result).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    version += 1;
    finish(null);
    await rejected;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});

describe("normalizeApiErrorBody", () => {
  it("unwraps the backend error envelope", () => {
    expect(
      normalizeApiErrorBody({
        error: {
          code: "SCENE_LOCATION_REQUIRED",
          message: "Update your location before using Scenes",
          requestId: "request-1",
          details: {},
        },
      }),
    ).toMatchObject({
      code: "SCENE_LOCATION_REQUIRED",
      message: "Update your location before using Scenes",
      requestId: "request-1",
    });
  });

  it("keeps compatibility with the legacy flat response and rejects invalid payloads", () => {
    expect(
      normalizeApiErrorBody({
        code: "UNAUTHORIZED",
        message: "Session rejected",
        requestId: "request-2",
      }),
    ).toMatchObject({ code: "UNAUTHORIZED" });
    expect(normalizeApiErrorBody({ error: "Bad Request" })).toBeNull();
  });
});
