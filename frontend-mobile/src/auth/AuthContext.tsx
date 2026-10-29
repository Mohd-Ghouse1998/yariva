import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authApi } from "../api/endpoints/auth";
import { usersApi } from "../api/endpoints/users";
import { ApiError, isNetworkError } from "../api/errors";
import { configureHttpClient } from "../api/http";
import type {
  AuthResponseDto,
  CurrentUserDto,
  LoginRequest,
  OtpPurpose,
  ProfileCompletionStatusDto,
  SignupRequest,
  TokenPairDto,
} from "../types/auth";
import { buildDeviceContext } from "../utils/device";
import { tokenStorage, type PersistedTokens } from "./storage";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated-pending" | "authenticated";

export type SessionRecoveryReason = "offline" | "timeout" | "server";

export interface AuthState {
  status: AuthStatus;
  user: CurrentUserDto | null;
  profileCompletion: ProfileCompletionStatusDto | null;
  tokens: PersistedTokens | null;
  sessionRecoveryReason: SessionRecoveryReason | null;
}

interface AuthActions {
  signup: (params: { email?: string; phone?: string; password: string }) => Promise<void>;
  login: (params: { identifier: string; password: string }) => Promise<void>;
  verifyOtp: (params: { phone: string; code: string; purpose: OtpPurpose }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retrySession: () => Promise<void>;
  setUser: (user: CurrentUserDto) => void;
  setProfileCompletion: (status: ProfileCompletionStatusDto) => void;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_BOOT_TIMEOUT_MS = 6000;
const SESSION_RETRY_DELAY_MS = 15_000;

export class SessionBootstrapTimeoutError extends Error {
  constructor() {
    super("session-bootstrap-timeout");
    this.name = "SessionBootstrapTimeoutError";
  }
}

export const isAuthoritativeSessionError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

export const classifySessionRecoveryReason = (error: unknown): SessionRecoveryReason => {
  if (error instanceof SessionBootstrapTimeoutError) return "timeout";
  if (isNetworkError(error)) return "offline";
  return "server";
};

export const toRecoverableSessionState = (
  previous: AuthState,
  tokens: PersistedTokens,
  error: unknown,
): AuthState => ({
  ...previous,
  status: "authenticated-pending",
  tokens: previous.tokens ?? tokens,
  sessionRecoveryReason: classifySessionRecoveryReason(error),
});

const unauthenticatedState = (): AuthState => ({
  status: "unauthenticated",
  tokens: null,
  user: null,
  profileCompletion: null,
  sessionRecoveryReason: null,
});

const getMeWithTimeout = async () => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      usersApi.me(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new SessionBootstrapTimeoutError()),
          SESSION_BOOT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

function tokensFromAuthResponse(r: AuthResponseDto | { tokens: TokenPairDto }): PersistedTokens {
  return {
    accessToken: r.tokens.accessToken,
    refreshToken: r.tokens.refreshToken,
    sessionId: r.tokens.session.id,
    accessExpiresAt: r.tokens.accessTokenExpiresAt,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    profileCompletion: null,
    tokens: null,
    sessionRecoveryReason: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const mountedRef = useRef(true);
  const sessionVersion = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearSession = useCallback(async () => {
    sessionVersion.current += 1;
    const next = unauthenticatedState();
    stateRef.current = next;
    if (mountedRef.current) setState(next);
    await tokenStorage.clear();
  }, []);

  const markSessionRecoverable = useCallback((tokens: PersistedTokens, error: unknown) => {
    if (!mountedRef.current) return;
    setState((previous) => toRecoverableSessionState(previous, tokens, error));
  }, []);

  const verifyPersistedSession = useCallback(
    async (persisted: PersistedTokens): Promise<void> => {
      const version = sessionVersion.current;
      try {
        const me = await getMeWithTimeout();
        if (!mountedRef.current || version !== sessionVersion.current) return;
        const latestTokens = await tokenStorage.load().catch(() => null);
        if (!mountedRef.current || version !== sessionVersion.current) return;
        setState({
          status: "authenticated",
          tokens: latestTokens ?? stateRef.current.tokens ?? persisted,
          user: me.user,
          profileCompletion: me.profileCompletion,
          sessionRecoveryReason: null,
        });
      } catch (error) {
        if (!mountedRef.current || version !== sessionVersion.current) return;
        if (isAuthoritativeSessionError(error)) {
          await clearSession();
          return;
        }
        markSessionRecoverable(persisted, error);
      }
    },
    [clearSession, markSessionRecoverable],
  );

  // Wire HTTP client to current auth state.
  useEffect(() => {
    configureHttpClient({
      getAccessToken: async () => stateRef.current.tokens?.accessToken ?? null,
      getSessionVersion: () => sessionVersion.current,
      refresh: async () => {
        const version = sessionVersion.current;
        const current = stateRef.current.tokens;
        if (!current?.refreshToken) return null;
        try {
          const refreshed = await authApi.refresh({ refreshToken: current.refreshToken });
          if (!mountedRef.current || version !== sessionVersion.current) return null;
          const next = tokensFromAuthResponse(refreshed);
          await tokenStorage.save(next);
          if (!mountedRef.current || version !== sessionVersion.current) return null;
          stateRef.current = { ...stateRef.current, tokens: next, user: refreshed.user };
          setState((prev) => ({ ...prev, tokens: next, user: refreshed.user }));
          return next.accessToken;
        } catch (error) {
          if (!mountedRef.current || version !== sessionVersion.current) return null;
          if (isAuthoritativeSessionError(error)) {
            await clearSession();
            return null;
          }
          markSessionRecoverable(current, error);
          // Let the original request fail without invoking onUnauthenticated.
          // A network or 5xx refresh failure is not evidence that credentials
          // are invalid, so callers can retry with the persisted session.
          throw error;
        }
      },
      onUnauthenticated: () => {
        void clearSession();
      },
    });
  }, [clearSession, markSessionRecoverable]);

  // Boot: try to load tokens then fetch /users/me.
  useEffect(() => {
    let mounted = true;
    const version = sessionVersion.current;
    void (async () => {
      let persisted: PersistedTokens | null = null;
      try {
        persisted = await tokenStorage.load();
      } catch {
        persisted = null;
      }
      if (!mounted || version !== sessionVersion.current) return;
      if (!persisted) {
        setState(unauthenticatedState());
        return;
      }
      setState((prev) => ({
        ...prev,
        status: "loading",
        tokens: persisted,
        sessionRecoveryReason: null,
      }));
      await verifyPersistedSession(persisted);
    })();
    return () => {
      mounted = false;
    };
  }, [verifyPersistedSession]);

  const retrySession = useCallback<AuthActions["retrySession"]>(async () => {
    const version = sessionVersion.current;
    const persisted = stateRef.current.tokens ?? (await tokenStorage.load().catch(() => null));
    if (!mountedRef.current || version !== sessionVersion.current) return;
    if (!persisted) {
      await clearSession();
      return;
    }
    setState((previous) => ({
      ...previous,
      status: "authenticated-pending",
      tokens: persisted,
      sessionRecoveryReason: null,
    }));
    await verifyPersistedSession(persisted);
  }, [clearSession, verifyPersistedSession]);

  useEffect(() => {
    if (state.status !== "authenticated-pending" || state.sessionRecoveryReason === null) {
      return;
    }
    const timer = setTimeout(() => {
      void retrySession();
    }, SESSION_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [retrySession, state.sessionRecoveryReason, state.status]);

  const applyAuthResponse = useCallback(async (r: AuthResponseDto, version: number) => {
    if (!mountedRef.current || version !== sessionVersion.current) return;
    const next = tokensFromAuthResponse(r);
    await tokenStorage.save(next);
    if (!mountedRef.current || version !== sessionVersion.current) return;
    const authenticated: AuthState = {
      status: "authenticated",
      tokens: next,
      user: r.user,
      profileCompletion: r.profileCompletion,
      sessionRecoveryReason: null,
    };
    stateRef.current = authenticated;
    setState(authenticated);
  }, []);

  const signup = useCallback<AuthActions["signup"]>(
    async (params) => {
      const version = ++sessionVersion.current;
      const device = await buildDeviceContext();
      const body: SignupRequest = {
        email: params.email ?? null,
        phone: params.phone ?? null,
        password: params.password,
        device,
      };
      const response = await authApi.signup(body);
      await applyAuthResponse(response, version);
    },
    [applyAuthResponse],
  );

  const login = useCallback<AuthActions["login"]>(
    async (params) => {
      const version = ++sessionVersion.current;
      const device = await buildDeviceContext();
      const body: LoginRequest = {
        identifier: params.identifier,
        password: params.password,
        device,
      };
      const response = await authApi.login(body);
      await applyAuthResponse(response, version);
    },
    [applyAuthResponse],
  );

  const verifyOtp = useCallback<AuthActions["verifyOtp"]>(
    async (params) => {
      const version = ++sessionVersion.current;
      const device = await buildDeviceContext();
      const response = await authApi.verifyOtp({ ...params, device });
      await applyAuthResponse(response, version);
    },
    [applyAuthResponse],
  );

  const logout = useCallback<AuthActions["logout"]>(async () => {
    const version = ++sessionVersion.current;
    try {
      await authApi.logout();
    } catch {
      // Ignore — log out locally either way.
    }
    if (version === sessionVersion.current) await clearSession();
  }, [clearSession]);

  const refreshUser = useCallback<AuthActions["refreshUser"]>(async () => {
    const version = sessionVersion.current;
    const me = await usersApi.me();
    if (!mountedRef.current || version !== sessionVersion.current) return;
    setState((prev) => ({
      ...prev,
      user: me.user,
      profileCompletion: me.profileCompletion,
      status: "authenticated",
      sessionRecoveryReason: null,
    }));
  }, []);

  const setUser = useCallback<AuthActions["setUser"]>((user) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  const setProfileCompletion = useCallback<AuthActions["setProfileCompletion"]>((status) => {
    setState((prev) => ({ ...prev, profileCompletion: status }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signup,
      login,
      verifyOtp,
      logout,
      refreshUser,
      retrySession,
      setUser,
      setProfileCompletion,
    }),
    [
      state,
      signup,
      login,
      verifyOtp,
      logout,
      refreshUser,
      retrySession,
      setUser,
      setProfileCompletion,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
