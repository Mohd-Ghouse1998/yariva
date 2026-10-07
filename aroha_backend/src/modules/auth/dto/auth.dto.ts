import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import type { ProfileCompletionCriterion } from "../../../common/services/profile-completion.service";

export const CLIENT_PLATFORM_VALUES = [
  "IOS",
  "ANDROID",
  "WEB",
  "UNKNOWN",
] as const;
export type ClientPlatformValue = (typeof CLIENT_PLATFORM_VALUES)[number];

export class DeviceContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly deviceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly deviceName?: string | null;

  @IsString()
  @IsIn(CLIENT_PLATFORM_VALUES)
  readonly platform!: ClientPlatformValue;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly appVersion?: string | null;
}

export class SignupDto {
  @IsOptional()
  @IsEmail()
  readonly email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly phone?: string | null;

  @IsString()
  readonly password!: string;

  @ValidateNested()
  @Type(() => DeviceContextDto)
  readonly device!: DeviceContextDto;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  readonly identifier!: string;

  @IsString()
  readonly password!: string;

  @ValidateNested()
  @Type(() => DeviceContextDto)
  readonly device!: DeviceContextDto;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  readonly refreshToken!: string;
}

export const OTP_PURPOSE_VALUES = ["LOGIN", "SIGNUP"] as const;
export type OtpPurposeValue = (typeof OTP_PURPOSE_VALUES)[number];

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  readonly phone!: string;

  @IsString()
  @IsIn(OTP_PURPOSE_VALUES)
  readonly purpose!: OtpPurposeValue;
}

export class VerifyOtpDto extends RequestOtpDto {
  @IsString()
  @Matches(/^\d{4,10}$/)
  readonly code!: string;

  @ValidateNested()
  @Type(() => DeviceContextDto)
  readonly device!: DeviceContextDto;
}

export interface AuthCapabilitiesDto {
  otp: {
    enabled: boolean;
    channel: "SMS" | null;
  };
}

export interface RequestOtpResponseDto {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface SessionDto {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  platform: ClientPlatformValue;
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
  role: "USER" | "MODERATOR" | "ADMIN";
  status: "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "BANNED" | "DELETED";
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
