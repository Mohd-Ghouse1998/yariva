import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export const EVENT_CATEGORIES = ["CULTURE", "MUSIC", "FOOD", "OUTDOORS", "WORKSHOP", "COMMUNITY"] as const;
export type EventCategoryValue = typeof EVENT_CATEGORIES[number];
export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"] as const;

export class EventQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsOptional() @IsString() @MaxLength(160) area?: string;
  @IsOptional() @IsIn(EVENT_CATEGORIES) category?: EventCategoryValue;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) until?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000) maxPricePaise?: number;
  @IsOptional() @IsIn(["true", "false"]) saved?: string;
  @IsOptional() @IsString() @MaxLength(512) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class AdminEventQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

// Full replacement with optimistic concurrency; no mass assignment of ORM data.
export class CurateEventDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsIn(EVENT_STATUSES) status!: typeof EVENT_STATUSES[number];
  @IsString() @IsNotEmpty() @MaxLength(140) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) description!: string;
  @IsIn(EVENT_CATEGORIES) category!: EventCategoryValue;
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) locality!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) venueName!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) venueAddress!: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
  @IsString() @IsNotEmpty() @MaxLength(64) timezone!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) priceMinPaise?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) priceMaxPaise?: number | null;
  @IsString() @IsNotEmpty() @MaxLength(1024) sourceUrl!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) sourceName!: string;
  @IsOptional() @IsString() @MaxLength(1024) bookingUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(1024) imageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imageRights?: string | null;
  @IsISO8601({ strict: true }) verifiedAt!: string;
}
