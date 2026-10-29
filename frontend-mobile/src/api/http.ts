import type { ApiErrorBody } from "../types/api";
import { handleFixture, isFixturesEnabled } from "../dev/fixtureRouter";
import { ApiError, normalizeApiErrorBody } from "./errors";
import { env } from "../utils/env";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  // Skip access-token injection (for /auth/refresh on 401 retry).
  skipAuth?: boolean;
}

export type AccessTokenProvider = () => Promise<string | null>;
export type RefreshHandler = () => Promise<string | null>;
export type UnauthenticatedHandler = () => void;

interface HttpClientConfig {
  baseUrl: string;
  getAccessToken: AccessTokenProvider;
  refresh: RefreshHandler;
  onUnauthenticated: UnauthenticatedHandler;
  getSessionVersion: () => number;
}

let config: HttpClientConfig = {
  baseUrl: env.apiBaseUrl,
  getAccessToken: async () => null,
  refresh: async () => null,
  onUnauthenticated: () => undefined,
  getSessionVersion: () => 0,
};

export function configureHttpClient(next: Partial<HttpClientConfig>): void {
  config = { ...config, ...next };
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `?${params.join("&")}` : "";
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = normalizeApiErrorBody(await response.json());
  } catch {
    body = null;
  }
  return new ApiError(response.status, body);
}

let refreshing: { version: number; promise: Promise<string | null> } | null = null;

async function doRequest<T>(
  path: string,
  options: RequestOptions,
  attempt: number,
  refreshedToken?: string,
  sessionVersion = config.getSessionVersion(),
): Promise<T> {
  const assertSession = () => {
    if (sessionVersion !== config.getSessionVersion()) {
      throw new ApiError(409, { code: "SESSION_CHANGED", message: "The account changed. Please try again.", requestId: "client-session" });
    }
  };
  if (isFixturesEnabled()) {
    return handleFixture<T>({
      method: options.method ?? "GET",
      path,
      query: options.query,
      body: options.body,
    });
  }
  const url = `${config.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}${buildQuery(options.query)}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  if (!options.skipAuth) {
    const token = refreshedToken ?? (await config.getAccessToken());
    assertSession();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined && options.body !== null) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
  });
  assertSession();

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  if (response.ok) {
    const text = await response.text();
    assertSession();
    if (!text) return undefined as unknown as T;
    return JSON.parse(text) as T;
  }

  const err = await parseError(response);
  assertSession();
  if (err.isAuthInvalid() && attempt === 0 && !options.skipAuth) {
    if (!refreshing || refreshing.version !== sessionVersion) {
      const pending = { version: sessionVersion, promise: config.refresh() };
      refreshing = pending;
      void pending.promise.finally(() => {
        if (refreshing === pending) refreshing = null;
      }).catch(() => undefined);
    }
    const newToken = await refreshing.promise;
    assertSession();
    if (newToken) {
      // React may not have committed the auth state update yet.
      return doRequest<T>(path, options, attempt + 1, newToken, sessionVersion);
    }
    config.onUnauthenticated();
  }
  throw err;
}

export const http = {
  request: <T>(path: string, options: RequestOptions = {}): Promise<T> =>
    doRequest<T>(path, options, 0),
  get: <T>(path: string, query?: RequestOptions["query"], opts?: Omit<RequestOptions, "method" | "query">) =>
    doRequest<T>(path, { ...opts, method: "GET", query }, 0),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "POST", body }, 0),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "PATCH", body }, 0),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "PUT", body }, 0),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method">) =>
    doRequest<T>(path, { ...opts, method: "DELETE" }, 0),
};
