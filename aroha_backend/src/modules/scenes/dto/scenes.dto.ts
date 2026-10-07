import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export const SCENE_INTENT_VALUES = ["DATING", "FRIENDSHIP", "CASUAL_HANG"] as const;
export type SceneIntentValue = (typeof SCENE_INTENT_VALUES)[number];

export class CreateSceneDto {
  @IsIn(SCENE_INTENT_VALUES)
  readonly intent!: SceneIntentValue;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly activity!: string;

  @IsOptional()
  @ValidateIf(({ photoId }) => photoId !== null)
  @IsUUID()
  readonly photoId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9 -]{0,29}$/, { each: true })
  readonly tags?: string[];

  @IsOptional()
  @ValidateIf(({ availableFrom }) => availableFrom !== null)
  @IsDateString()
  readonly availableFrom?: string | null;

  @IsOptional()
  @ValidateIf(({ availableUntil }) => availableUntil !== null)
  @IsDateString()
  readonly availableUntil?: string | null;
}

export class UpdateSceneDto {
  @IsOptional()
  @IsIn(SCENE_INTENT_VALUES)
  readonly intent?: SceneIntentValue;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly activity?: string;

  @IsOptional()
  @ValidateIf(({ photoId }) => photoId !== null)
  @IsUUID()
  readonly photoId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9 -]{0,29}$/, { each: true })
  readonly tags?: string[];

  @IsOptional()
  @ValidateIf(({ availableFrom }) => availableFrom !== null)
  @IsDateString()
  readonly availableFrom?: string | null;

  @IsOptional()
  @ValidateIf(({ availableUntil }) => availableUntil !== null)
  @IsDateString()
  readonly availableUntil?: string | null;
}

export class SceneDiscoveryQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  readonly limit?: number;
}

export interface SceneDto {
  id: string;
  ownerId: string;
  lineageId: string;
  version: number;
  intent: SceneIntentValue;
  activity: string;
  photo: {
    id: string;
    url: string;
    width: number | null;
    height: number | null;
  } | null;
  tags: string[];
  availableFrom: string | null;
  availableUntil: string | null;
  expiresAt: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED" | "REPLACED";
  createdAt: string;
}

export interface SceneCandidateDto {
  scene: SceneDto;
  profile: {
    userId: string;
    displayName: string;
    headline: string | null;
    city: string | null;
    region: string | null;
    verificationStatus: string;
    photoUrl: string | null;
  };
  distance: { roundedKm: number; band: "LOCAL" | "NEARBY" | "FARTHER" };
  availability: "CONFIRMED" | "UNCONFIRMED";
}

export interface SceneDiscoveryPageDto {
  items: SceneCandidateDto[];
  nextCursor: string | null;
}

export interface SceneCapabilitiesDto {
  enabled: boolean;
  radiusMeters: number;
  lifetimeHours: number;
}
