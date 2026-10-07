import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { sessionsApi } from "../api/endpoints/sessions";
import { buildDeviceContext, getClientPlatform } from "../utils/device";

const STORAGE_KEY = "yariva.nativePushRegistration";

interface StoredRegistration {
  id: string;
  token: string;
}

export type PushRegistrationResult =
  | "REGISTERED"
  | "PERMISSION_DENIED"
  | "NOT_SUPPORTED";

export async function syncPushRegistration(
  requestPermission: boolean,
): Promise<PushRegistrationResult> {
  if (!Device.isDevice || (Platform.OS !== "android" && Platform.OS !== "ios")) {
    return "NOT_SUPPORTED";
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted" && requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== "granted") return "PERMISSION_DENIED";

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Matches and messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
    });
  }

  const nativeToken = await Notifications.getDevicePushTokenAsync();
  const token = typeof nativeToken.data === "string" ? nativeToken.data : JSON.stringify(nativeToken.data);
  const device = await buildDeviceContext();
  const registered = await sessionsApi.registerPushToken({
    token,
    provider: Platform.OS === "ios" ? "APNS" : "FCM",
    platform: getClientPlatform(),
    deviceId: device.deviceId,
  });
  const previous = await loadStoredRegistration();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ id: registered.id, token: registered.token } satisfies StoredRegistration),
  );
  if (previous && previous.id !== registered.id && previous.token !== registered.token) {
    await sessionsApi.removePushToken(previous.id).catch(() => undefined);
  }
  return "REGISTERED";
}

async function loadStoredRegistration(): Promise<StoredRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRegistration>;
    return typeof parsed.id === "string" && typeof parsed.token === "string"
      ? { id: parsed.id, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}
