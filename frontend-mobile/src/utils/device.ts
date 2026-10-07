import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { ClientPlatform } from "../types/enums";
import type { DeviceContextDto } from "../types/auth";

export function getClientPlatform(): ClientPlatform {
  if (Platform.OS === "ios") return "IOS";
  if (Platform.OS === "android") return "ANDROID";
  if (Platform.OS === "web") return "WEB";
  return "UNKNOWN";
}

export async function buildDeviceContext(): Promise<DeviceContextDto> {
  let deviceId: string | null = null;
  try {
    if (Platform.OS === "android") {
      deviceId = Application.getAndroidId() ?? null;
    } else if (Platform.OS === "ios") {
      deviceId = await Application.getIosIdForVendorAsync();
    }
  } catch {
    deviceId = null;
  }
  return {
    deviceId,
    deviceName: Device.modelName ?? Device.deviceName ?? null,
    platform: getClientPlatform(),
    appVersion: Application.nativeApplicationVersion ?? null,
  };
}
