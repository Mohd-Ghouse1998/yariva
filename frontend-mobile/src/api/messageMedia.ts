import type { ImageSourcePropType } from "react-native";
import { env } from "../utils/env";

// Never send a bearer token to a profile-photo or arbitrary external URL.
export function messageMediaSource(url: string | null, token?: string): ImageSourcePropType | undefined {
  if (!url) return undefined;
  if (/^messages\/[a-zA-Z0-9-]+\/attachment$/.test(url)) {
    if (!token) return undefined;
    return {
      uri: `${env.apiBaseUrl.replace(/\/$/, "")}/${url}`,
      headers: { Authorization: `Bearer ${token}` },
      cache: "reload",
    };
  }
  return { uri: url };
}
