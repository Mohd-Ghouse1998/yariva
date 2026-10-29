import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// SecureStore is unavailable on web; fall back to AsyncStorage there.
const useSecure = Platform.OS !== "web";

const KEYS = {
  accessToken: "aroha.accessToken",
  refreshToken: "aroha.refreshToken",
  sessionId: "aroha.sessionId",
  accessExpiresAt: "aroha.accessExpiresAt",
} as const;

async function setItem(key: string, value: string): Promise<void> {
  if (useSecure) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (useSecure) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

async function removeItem(key: string): Promise<void> {
  if (useSecure) await SecureStore.deleteItemAsync(key);
  else await AsyncStorage.removeItem(key);
}

export interface PersistedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresAt: string;
}

// Save and logout can overlap while SecureStore writes individual keys.
// Preserve operation order so a late save cannot restore a cleared session.
let pendingWrite = Promise.resolve();
function writeInOrder(operation: () => Promise<unknown>[]): Promise<void> {
  const result = pendingWrite.then(async () => {
    // A rejected key must not release the queue while sibling writes continue.
    const results = await Promise.allSettled(operation());
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  });
  pendingWrite = result.catch(() => undefined);
  return result;
}

export const tokenStorage = {
  async load(): Promise<PersistedTokens | null> {
    await pendingWrite;
    const [a, r, s, e] = await Promise.all([
      getItem(KEYS.accessToken),
      getItem(KEYS.refreshToken),
      getItem(KEYS.sessionId),
      getItem(KEYS.accessExpiresAt),
    ]);
    if (!a || !r || !s || !e) return null;
    return { accessToken: a, refreshToken: r, sessionId: s, accessExpiresAt: e };
  },

  async save(t: PersistedTokens): Promise<void> {
    await writeInOrder(() => [
      setItem(KEYS.accessToken, t.accessToken),
      setItem(KEYS.refreshToken, t.refreshToken),
      setItem(KEYS.sessionId, t.sessionId),
      setItem(KEYS.accessExpiresAt, t.accessExpiresAt),
    ]);
  },

  async clear(): Promise<void> {
    await writeInOrder(() => [
      removeItem(KEYS.accessToken),
      removeItem(KEYS.refreshToken),
      removeItem(KEYS.sessionId),
      removeItem(KEYS.accessExpiresAt),
    ]);
  },
};
