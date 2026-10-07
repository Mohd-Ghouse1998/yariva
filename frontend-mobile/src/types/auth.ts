import type { ClientPlatform, ProfileCompletionCriterion, UserRole, UserStatus } from "./enums";

export interface DeviceContextDto {
  deviceId?: string | null;
  deviceName?: string | null;
  platform: ClientPlatform;
  appVersion?: string | null;
}

export interface SignupRequest {
  email?: string | null;
  phone?: string | null;
  password: string;
  device: DeviceContextDto;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  device: DeviceContextDto;
}

export type OtpPurpose = "LOGIN" | "SIGNUP";

export interface AuthCapabilitiesDto {
  otp: {
    enabled: boolean;
    channel: "SMS" | null;
  };
}

export interface RequestOtpRequest {
  phone: string;
  purpose: OtpPurpose;
}

export interface RequestOtpResponseDto {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerifyOtpRequest extends RequestOtpRequest {
  code: string;
  device: DeviceContextDto;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface SessionDto {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  platform: ClientPlatform;
  appVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export interface TokenPairDto {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  session: SessionDto;
}

export interface CurrentUserDto {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  isShadowBanned: boolean;
  isDiscoveryFrozen: boolean;
  isChatFrozen: boolean;
  isCallFrozen: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletionStatusDto {
  isComplete: boolean;
  completedAt: string | null;
  missingCriteria: ProfileCompletionCriterion[];
}

export interface AuthResponseDto {
  tokens: TokenPairDto;
  user: CurrentUserDto;
  profileCompletion: ProfileCompletionStatusDto;
}

export interface RefreshResponseDto {
  tokens: TokenPairDto;
  user: CurrentUserDto;
}

export interface GetMeResponseDto {
  user: CurrentUserDto;
  profileCompletion: ProfileCompletionStatusDto;
}
