import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/errors";
import type { GetMeResponseDto } from "../types/auth";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
  usersMe: vi.fn(),
  configureHttpClient: vi.fn(),
  refresh: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("./storage", () => ({
  tokenStorage: {
    load: mocks.load,
    save: mocks.save,
    clear: mocks.clear,
  },
}));

vi.mock("../api/endpoints/users", () => ({
  usersApi: {
    me: mocks.usersMe,
  },
}));

vi.mock("../api/endpoints/auth", () => ({
  authApi: {
    refresh: mocks.refresh,
    signup: vi.fn(),
    login: mocks.login,
    logout: mocks.logout,
  },
}));

vi.mock("../api/http", () => ({
  configureHttpClient: mocks.configureHttpClient,
}));

vi.mock("../utils/device", () => ({
  buildDeviceContext: vi.fn(),
}));

import {
  AuthProvider,
  SessionBootstrapTimeoutError,
  classifySessionRecoveryReason,
  isAuthoritativeSessionError,
  toRecoverableSessionState,
  useAuth,
  type AuthState,
} from "./AuthContext";

const persisted = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  sessionId: "session-1",
  accessExpiresAt: "2026-09-01T00:00:00.000Z",
};

const me: GetMeResponseDto = {
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "person@example.test",
    phone: null,
    role: "USER",
    status: "ACTIVE",
    isShadowBanned: false,
    isDiscoveryFrozen: false,
    isChatFrozen: false,
    isCallFrozen: false,
    lastActiveAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  profileCompletion: {
    isComplete: true,
    completedAt: "2026-08-02T00:00:00.000Z",
    missingCriteria: [],
  },
};

const apiError = (status: number) =>
  new ApiError(status, {
    statusCode: status,
    error: status === 401 ? "Unauthorized" : "Forbidden",
    message: "Session rejected",
    code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
    requestId: "request-1",
    timestamp: "2026-08-30T00:00:00.000Z",
  });

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue(persisted);
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.clear.mockReset().mockResolvedValue(undefined);
  mocks.usersMe.mockReset();
  mocks.configureHttpClient.mockReset();
  mocks.refresh.mockReset();
  mocks.login.mockReset();
  mocks.logout.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = null;
  }
});

describe("persisted session recovery", () => {
  it("discards boot and profile responses that finish after logout", async () => {
    let finish!: (response: GetMeResponseDto) => void;
    mocks.usersMe.mockImplementation(() => new Promise<GetMeResponseDto>(resolve => { finish = resolve; }));
    let auth!: ReturnType<typeof useAuth>;
    const Probe = () => { auth = useAuth(); return null; };
    await act(async () => { renderer = create(<AuthProvider><Probe /></AuthProvider>); });
    await act(async () => { await auth.logout(); });
    await act(async () => { finish(me); });
    expect(auth.status).toBe("unauthenticated");

    let pending!: Promise<void>;
    await act(async () => { pending = auth.refreshUser(); });
    await act(async () => { await auth.logout(); });
    await act(async () => { finish(me); await pending; });
    expect(auth.user).toBeNull();
    expect(auth.tokens).toBeNull();
  });

  it("cannot restore a previous account from a delayed token refresh", async () => {
    mocks.usersMe.mockResolvedValue(me);
    let auth!: ReturnType<typeof useAuth>;
    const Probe = () => { auth = useAuth(); return null; };
    await act(async () => { renderer = create(<AuthProvider><Probe /></AuthProvider>); });
    let finish!: (value: unknown) => void;
    mocks.refresh.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const config = mocks.configureHttpClient.mock.calls.at(-1)![0] as { refresh: () => Promise<string | null> };
    let pending!: Promise<string | null>;
    await act(async () => { pending = config.refresh(); });
    await act(async () => { await auth.logout(); });
    await act(async () => {
      finish({ user: me.user, tokens: { accessToken: "late-token", refreshToken: "late-refresh", session: { id: "late-session" } } });
      expect(await pending).toBeNull();
    });
    expect(auth.user).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("keeps the new account when the old account's refresh and logout finish late", async () => {
    mocks.usersMe.mockResolvedValue(me);
    let auth!: ReturnType<typeof useAuth>;
    const Probe = () => { auth = useAuth(); return null; };
    await act(async () => { renderer = create(<AuthProvider><Probe /></AuthProvider>); });
    let finishRefresh!: (value: unknown) => void;
    let finishLogout!: () => void;
    mocks.refresh.mockImplementation(() => new Promise(resolve => { finishRefresh = resolve; }));
    mocks.logout.mockImplementation(() => new Promise<void>(resolve => { finishLogout = resolve; }));
    const config = mocks.configureHttpClient.mock.calls.at(-1)![0] as { refresh: () => Promise<string | null> };
    let pendingRefresh!: Promise<string | null>;
    let pendingLogout!: Promise<void>;
    await act(async () => { pendingRefresh = config.refresh(); pendingLogout = auth.logout(); });
    const nextUser = { ...me.user, id: "22222222-2222-2222-2222-222222222222" };
    mocks.login.mockResolvedValue({ user: nextUser, profileCompletion: me.profileCompletion,
      tokens: { accessToken: "account-b", refreshToken: "refresh-b", session: { id: "session-b" } } });
    await act(async () => { await auth.login({ identifier: "b@example.test", password: "password" }); });
    await act(async () => {
      finishRefresh({ user: me.user, tokens: { accessToken: "late-a", refreshToken: "late-refresh", session: { id: "late-session" } } });
      finishLogout();
      await pendingLogout;
      expect(await pendingRefresh).toBeNull();
    });
    expect(auth.user?.id).toBe(nextUser.id);
    expect(auth.tokens?.accessToken).toBe("account-b");
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it("keeps tokens and exposes retry after a boot-time network failure", async () => {
    mocks.usersMe
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(me);
    let auth: ReturnType<typeof useAuth> | null = null;
    const Probe = () => {
      auth = useAuth();
      return null;
    };

    await act(async () => {
      renderer = create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(auth).toMatchObject({
      status: "authenticated-pending",
      tokens: persisted,
      sessionRecoveryReason: "offline",
    });
    expect(mocks.clear).not.toHaveBeenCalled();

    await act(async () => {
      await auth?.retrySession();
    });

    expect(auth).toMatchObject({
      status: "authenticated",
      user: me.user,
      profileCompletion: me.profileCompletion,
      sessionRecoveryReason: null,
    });
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it("clears an authoritatively rejected persisted session", async () => {
    mocks.usersMe.mockRejectedValueOnce(apiError(401));
    let auth: ReturnType<typeof useAuth> | null = null;
    const Probe = () => {
      auth = useAuth();
      return null;
    };

    await act(async () => {
      renderer = create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(auth).toMatchObject({
      status: "unauthenticated",
      tokens: null,
      sessionRecoveryReason: null,
    });
    expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
});

describe("session failure classification", () => {
  it("treats only HTTP 401/403 as authoritative", () => {
    expect(isAuthoritativeSessionError(apiError(401))).toBe(true);
    expect(isAuthoritativeSessionError(apiError(403))).toBe(true);
    expect(isAuthoritativeSessionError(new ApiError(503, null))).toBe(false);
    expect(isAuthoritativeSessionError(new TypeError("Network request failed"))).toBe(false);
  });

  it("preserves known session data for timeout and server recovery", () => {
    const previous: AuthState = {
      status: "authenticated",
      user: me.user,
      profileCompletion: me.profileCompletion,
      tokens: persisted,
      sessionRecoveryReason: null,
    };
    const recovered = toRecoverableSessionState(
      previous,
      persisted,
      new ApiError(503, null),
    );

    expect(recovered).toMatchObject({
      status: "authenticated-pending",
      tokens: persisted,
      user: me.user,
      profileCompletion: me.profileCompletion,
      sessionRecoveryReason: "server",
    });
    expect(
      classifySessionRecoveryReason(new SessionBootstrapTimeoutError()),
    ).toBe("timeout");
  });
});
