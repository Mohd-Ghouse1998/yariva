import Constants from "expo-constants";

interface EnvShape {
  apiBaseUrl: string;
  wsUrl: string;
  stunUrls: string[];
  turnUrl: string | null;
  turnUsername: string | null;
  turnCredential: string | null;
}

// Expo inlines EXPO_PUBLIC_* variables only when each property is referenced
// directly. Keep this map explicit; dynamically reading process.env[name]
// works in Node but leaves release APKs without their build configuration.
const bundledPublicEnv: Record<string, string | undefined> = {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WS_URL: process.env.EXPO_PUBLIC_WS_URL,
  EXPO_PUBLIC_STUN_URLS: process.env.EXPO_PUBLIC_STUN_URLS,
  EXPO_PUBLIC_TURN_URL: process.env.EXPO_PUBLIC_TURN_URL,
  EXPO_PUBLIC_TURN_USERNAME: process.env.EXPO_PUBLIC_TURN_USERNAME,
  EXPO_PUBLIC_TURN_CREDENTIAL: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
  EXPO_PUBLIC_USE_FIXTURES: process.env.EXPO_PUBLIC_USE_FIXTURES,
  EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
};

function readPublicEnv(name: string, fallback?: string): string | undefined {
  const extra = (Constants?.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra = extra[name];
  return bundledPublicEnv[name] ?? (fromExtra as string | undefined) ?? fallback;
}

const productionBuild =
  typeof process !== "undefined" && process.env?.NODE_ENV === "production";
const configuredApiBaseUrl = readPublicEnv("EXPO_PUBLIC_API_BASE_URL")?.trim();
const configuredWsUrl = readPublicEnv("EXPO_PUBLIC_WS_URL")?.trim();
const fixtureDemoBuild =
  (readPublicEnv("EXPO_PUBLIC_USE_FIXTURES") === "1" ||
    readPublicEnv("EXPO_PUBLIC_USE_FIXTURES") === "true") &&
  (readPublicEnv("EXPO_PUBLIC_DEMO_MODE") === "1" ||
    readPublicEnv("EXPO_PUBLIC_DEMO_MODE") === "true");

if (productionBuild && !fixtureDemoBuild && (!configuredApiBaseUrl || !configuredWsUrl)) {
  throw new Error(
    "Yariva production configuration requires EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_WS_URL.",
  );
}

export const env: EnvShape = {
  apiBaseUrl: configuredApiBaseUrl || "http://localhost:3000/api/v1",
  wsUrl: configuredWsUrl || "http://localhost:3000",
  stunUrls: (readPublicEnv("EXPO_PUBLIC_STUN_URLS", "stun:stun.l.google.com:19302") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  turnUrl: readPublicEnv("EXPO_PUBLIC_TURN_URL") ?? null,
  turnUsername: readPublicEnv("EXPO_PUBLIC_TURN_USERNAME") ?? null,
  turnCredential: readPublicEnv("EXPO_PUBLIC_TURN_CREDENTIAL") ?? null,
};
