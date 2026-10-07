import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("public runtime configuration", () => {
  it("fails clearly when production API configuration is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_WS_URL", "");

    await expect(import("./env")).rejects.toThrow(
      "Yariva production configuration requires EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_WS_URL.",
    );
  });

  it("uses explicitly configured production endpoints", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1");
    vi.stubEnv("EXPO_PUBLIC_WS_URL", "https://api.example.test");

    const { env } = await import("./env");
    expect(env.apiBaseUrl).toBe("https://api.example.test/api/v1");
    expect(env.wsUrl).toBe("https://api.example.test");
  });

  it("permits missing endpoints only for an explicit fixture demo build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_WS_URL", "");
    vi.stubEnv("EXPO_PUBLIC_USE_FIXTURES", "1");
    vi.stubEnv("EXPO_PUBLIC_DEMO_MODE", "1");

    const { env } = await import("./env");
    expect(env.apiBaseUrl).toBe("http://localhost:3000/api/v1");
  });
});
