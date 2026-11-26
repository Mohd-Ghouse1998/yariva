import { expect, it, vi } from "vitest";
import * as Notifications from "expo-notifications";
import { sessionsApi } from "../api/endpoints/sessions";
import { syncPushRegistration } from "./pushRegistration";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(() => ({ status: "undetermined" })),
  requestPermissionsAsync: vi.fn(() => ({ status: "granted" })),
  getDevicePushTokenAsync: vi.fn(() => ({ type: "android", data: "native-token" })),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("../api/endpoints/sessions", () => ({
  sessionsApi: { registerPushToken: vi.fn(() => ({ id: "registration", token: "native-token" })) },
}));
vi.mock("../utils/device", () => ({
  buildDeviceContext: vi.fn(() => ({ deviceId: "device" })),
  getClientPlatform: vi.fn(() => "ANDROID"),
}));

it("creates the Android channel before requesting permission and registers the FCM token", async () => {
  await expect(syncPushRegistration(true)).resolves.toBe("REGISTERED");

  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("default", expect.any(Object));
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledBefore(vi.mocked(Notifications.requestPermissionsAsync));
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledBefore(vi.mocked(Notifications.getDevicePushTokenAsync));
  expect(sessionsApi.registerPushToken).toHaveBeenCalledWith({
    token: "native-token",
    provider: "FCM",
    platform: "ANDROID",
    deviceId: "device",
  });
});
