import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export const ANALYTICS_SOURCE_VALUES = ["MOBILE", "SYSTEM", "ADMIN"] as const;

export class AnalyticsEventInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly clientEventId?: string | null;

  @IsString()
  @MaxLength(120)
  readonly eventName!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  readonly occurredAt!: string;

  @IsIn(ANALYTICS_SOURCE_VALUES)
  readonly source!: (typeof ANALYTICS_SOURCE_VALUES)[number];

  @IsObject()
  readonly properties!: Record<string, unknown>;
}

export class IngestAnalyticsEventsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventInputDto)
  readonly events!: AnalyticsEventInputDto[];
}

export interface IngestAnalyticsEventsResponseDto {
  acceptedCount: number;
}

export interface AnalyticsSummaryDto {
  window: "24h" | "7d" | "30d";
  metrics: {
    signups: number;
    activeUsers: number;
    likes: number;
    matches: number;
    messages: number;
    reports: number;
    callAttempts: number;
  };
}

