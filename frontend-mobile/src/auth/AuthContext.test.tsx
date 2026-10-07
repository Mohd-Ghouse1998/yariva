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
    refresh: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
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
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = null;
  }
});

describe("persisted session recovery", () => {
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
