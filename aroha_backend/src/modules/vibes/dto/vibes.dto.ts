import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export const VIBE_FILTER_VALUES = ["ORIGINAL", "WARM", "COOL", "MONO", "POP"] as const;
export const VIBE_AUDIO_MODE_VALUES = ["ORIGINAL", "MUTED", "CUSTOM"] as const;
export type VibeFilterValue = (typeof VIBE_FILTER_VALUES)[number];
export type VibeAudioModeValue = (typeof VIBE_AUDIO_MODE_VALUES)[number];

export class VibeUploadAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  readonly fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  readonly sizeBytes!: number;
}

export class InitiateVibeUploadDto {
  @ValidateNested()
  @Type(() => VibeUploadAssetDto)
  readonly video!: VibeUploadAssetDto;

  @IsOptional()
  @ValidateIf(({ music }) => music !== null)
  @ValidateNested()
  @Type(() => VibeUploadAssetDto)
  readonly music?: VibeUploadAssetDto | null;

  @IsIn(VIBE_FILTER_VALUES)
  readonly filter!: VibeFilterValue;

  @IsIn(VIBE_AUDIO_MODE_VALUES)
  readonly audioMode!: VibeAudioModeValue;
}

export class FinalizeVibeAssetDto {
  @IsString()
  @IsNotEmpty()
  readonly uploadToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  readonly objectKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly bucket!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly mimeType!: string;

  @IsInt()
  @Min(1)
  readonly sizeBytes!: number;
}

export class FinalizeVibeUploadDto {
  @ValidateNested()
  @Type(() => FinalizeVibeAssetDto)
  readonly video!: FinalizeVibeAssetDto;

  @IsOptional()
  @ValidateIf(({ music }) => music !== null)
  @ValidateNested()
  @Type(() => FinalizeVibeAssetDto)
  readonly music?: FinalizeVibeAssetDto | null;
}

export interface VibeDto {
  id: string;
  userId: string;
  status: "UPLOADING" | "PROCESSING" | "READY" | "REJECTED" | "FAILED" | "REMOVED";
  filter: VibeFilterValue;
  audioMode: VibeAudioModeValue;
  musicName: string | null;
  durationMs: number | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
