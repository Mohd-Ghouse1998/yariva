import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export const FEATURE_FLAG_SCOPE_VALUES = [
  "GLOBAL",
  "USER_PERCENTAGE",
  "USER_ALLOWLIST",
] as const;

export type FeatureFlagScopeValue =
  (typeof FEATURE_FLAG_SCOPE_VALUES)[number];

export class UpsertFeatureFlagDto {
  @IsOptional()
  @ValidateIf(({ description }) => description !== null)
  @IsString()
  @MaxLength(500)
  readonly description?: string | null;

  @IsIn(FEATURE_FLAG_SCOPE_VALUES)
  readonly scope!: FeatureFlagScopeValue;

  @IsBoolean()
  readonly enabled!: boolean;

  @IsOptional()
  @ValidateIf(({ rolloutPercentage }) => rolloutPercentage !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  readonly rolloutPercentage?: number | null;

  @IsOptional()
  @ValidateIf(({ variant }) => variant !== null)
  @IsString()
  @MaxLength(50)
  readonly variant?: string | null;

  @IsOptional()
  @IsObject()
  readonly config?: Record<string, unknown>;

  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  readonly allowlistUserIds!: string[];
}

export interface FeatureFlagDto {
  id: string;
  key: string;
  description: string | null;
  scope: FeatureFlagScopeValue;
  enabled: boolean;
  rolloutPercentage: number | null;
  variant: string | null;
  config: Record<string, unknown>;
  allowlistUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagListDto {
  items: FeatureFlagDto[];
  nextCursor: string | null;
}

export interface FeatureFlagResponseDto {
  featureFlag: FeatureFlagDto;
}

export interface FeatureFlagEvaluation {
  key: string;
  enabled: boolean;
  variant: string | null;
  config: Record<string, unknown>;
}

