import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CLIENT_PLATFORM_VALUES, type SessionDto } from "../../auth/dto/auth.dto";

export const PUSH_PROVIDER_VALUES = ["APNS", "FCM"] as const;
export type PushProviderValue = (typeof PUSH_PROVIDER_VALUES)[number];

export class PushTokenDto {
  @IsString()
  @MaxLength(512)
  readonly token!: string;

  @IsString()
  @IsIn(CLIENT_PLATFORM_VALUES)
  readonly platform!: (typeof CLIENT_PLATFORM_VALUES)[number];

  @IsString()
  @IsIn(PUSH_PROVIDER_VALUES)
  readonly provider!: PushProviderValue;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly deviceId?: string | null;
}

export interface SessionPageDto {
  items: SessionDto[];
  nextCursor: string | null;
}

export interface RevokeOtherSessionsResponseDto {
  revokedCount: number;
}

export interface PushTokenResponseDto {
  id: string;
  token: string;
  platform: (typeof CLIENT_PLATFORM_VALUES)[number];
  provider: PushProviderValue;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}
