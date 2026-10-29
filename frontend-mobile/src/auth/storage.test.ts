import { beforeEach, describe, expect, it, vi } from "vitest";

const secure = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn(), remove: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED: "unlocked",
  setItemAsync: secure.set,
  getItemAsync: secure.get,
  deleteItemAsync: secure.remove,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));

import { tokenStorage } from "./storage";

const tokens = {
  accessToken: "access",
  refreshToken: "refresh",
  sessionId: "session",
  accessExpiresAt: "expires",
};
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  secure.set.mockReset().mockImplementation(async (key: string, value: string) => {
    values.set(key, value);
  });
  secure.get.mockReset().mockImplementation(async (key: string) => values.get(key) ?? null);
  secure.remove.mockReset().mockImplementation(async (key: string) => {
    values.delete(key);
  });
});

describe("session persistence ordering", () => {
  it("finishes all pending writes before logout clears the session", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    secure.set.mockImplementation(async (key: string, value: string) => {
      await delayed;
      values.set(key, value);
    });
    const save = tokenStorage.save(tokens);
    await vi.waitFor(() => expect(secure.set).toHaveBeenCalledTimes(4));
    const clear = tokenStorage.clear();
    const load = tokenStorage.load();
    expect(secure.remove).not.toHaveBeenCalled();
    release();
    await Promise.all([save, clear]);
    expect(await load).toBeNull();
    expect(values.size).toBe(0);
  });

  it("allows cleanup and a new account save after a failed write", async () => {
    secure.set.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(tokenStorage.save(tokens)).rejects.toThrow("storage unavailable");
    await tokenStorage.clear();
    const next = { ...tokens, accessToken: "account-b" };
    await tokenStorage.save(next);
    expect(await tokenStorage.load()).toEqual(next);
  });

  it("waits for remaining key writes when one key fails before logout", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    secure.set.mockImplementation(async (key: string, value: string) => {
      if (key === "aroha.accessToken") throw new Error("storage unavailable");
      await delayed;
      values.set(key, value);
    });
    const saveResult = tokenStorage.save(tokens).catch((error) => error);
    await vi.waitFor(() => expect(secure.set).toHaveBeenCalledTimes(4));
    const clear = tokenStorage.clear();
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(secure.remove).not.toHaveBeenCalled();
    } finally {
      release();
      await saveResult;
      await clear;
    }
    expect(await tokenStorage.load()).toBeNull();
    expect(values.size).toBe(0);
  });
});
