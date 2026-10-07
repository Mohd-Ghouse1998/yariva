import type { ClientPlatform, PushProvider } from "./enums";
import type { SessionDto } from "./auth";

export interface SessionPageDto {
  items: SessionDto[];
  nextCursor: string | null;
}

export interface RevokeOtherSessionsResponse {
  revokedCount: number;
}

export interface PushTokenRequest {
  token: string;
  provider: PushProvider;
  platform: ClientPlatform;
  deviceId?: string | null;
}

export interface PushTokenDto {
  id: string;
  token: string;
  provider: PushProvider;
  platform: ClientPlatform;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}
