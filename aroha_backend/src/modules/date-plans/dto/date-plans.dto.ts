import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export const DATE_PLAN_STATUS_VALUES = [
  "DRAFT",
  "PROPOSED",
  "COUNTERED",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
] as const;

export const DATE_SAFETY_STATUS_VALUES = [
  "ARRIVED",
  "OKAY",
  "NEED_HELP",
  "LEFT_EARLY",
] as const;

export type DatePlanStatusValue = (typeof DATE_PLAN_STATUS_VALUES)[number];
export type DateSafetyStatusValue = (typeof DATE_SAFETY_STATUS_VALUES)[number];

export const VENUE_CATEGORY_VALUES = ["CAFE", "RESTAURANT", "ACTIVITY"] as const;
export type VenueCategoryValue = (typeof VENUE_CATEGORY_VALUES)[number];
export const VENUE_LOCATION_MODE_VALUES = ["MIDPOINT", "ME", "AREA"] as const;
export type VenueLocationModeValue = (typeof VENUE_LOCATION_MODE_VALUES)[number];

export class VenueSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly query?: string;

  @IsOptional()
  @IsIn(VENUE_CATEGORY_VALUES)
  readonly category?: VenueCategoryValue;

  @IsOptional()
  @IsIn(VENUE_LOCATION_MODE_VALUES)
  readonly locationMode?: VenueLocationModeValue;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly area?: string;
}

export interface VenueSuggestionDto {
  id: string;
  name: string;
  photoUrl: string | null;
  address: string;
  publicLocality: string;
  reviewLabel: "Venue details reviewed";
  reviewSource: string | null;
  reviewedAt: string | null;
  availability: "OPEN" | "CLOSED" | "UNKNOWN";
  category: VenueCategoryValue | "OTHER";
  priceMinPerPerson?: number | null;
  priceMaxPerPerson?: number | null;
  currency?: string;
  priceTier: "₹" | "₹₹" | "₹₹₹" | null;
  rating: number | null;
  ratingCount: number | null;
  distanceKm: number | null;
  accessibilityFacts: string[];
  atmosphereTags: string[];
  isSynthetic: boolean;
}

export interface VenueSuggestionsResponseDto {
  items: VenueSuggestionDto[];
  manualFallbackAvailable: true;
}

export class CreateDatePlanDto {
  @IsOptional() @IsUUID()
  readonly eventId?: string;

  @IsOptional() @IsInt() @Min(1)
  readonly eventVersion?: number;

  @IsOptional()
  @IsUUID()
  readonly reviewedVenueId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  readonly title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  readonly description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  readonly activityType!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  readonly proposedStartAt!: string;

  // Event invitations use the server's canonical duration, including festivals
  // longer than a normal one-to-one meetup. Never trust this client value.
  @ValidateIf((input: CreateDatePlanDto) => !input.eventId)
  @IsInt()
  @Min(45)
  @Max(360)
  readonly durationMinutes!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly timezone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly publicLocality!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly venueName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly venueAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly idempotencyKey?: string;
}

export class CounterDatePlanDto {
  @IsOptional()
  @IsUUID()
  readonly reviewedVenueId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  readonly title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  readonly description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  readonly activityType?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  readonly proposedStartAt?: string;

  @IsOptional()
  @IsInt()
  @Min(45)
  @Max(360)
  readonly durationMinutes?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly timezone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly publicLocality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly venueName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly venueAddress?: string | null;

  @ValidateIf((value: CounterDatePlanDto) =>
    value.title === undefined &&
    value.description === undefined &&
    value.activityType === undefined &&
    value.proposedStartAt === undefined &&
    value.durationMinutes === undefined &&
    value.timezone === undefined &&
    value.publicLocality === undefined &&
    value.reviewedVenueId === undefined &&
    value.venueName === undefined &&
    value.venueAddress === undefined,
  )
  @IsBoolean({ message: "Include at least one counter-proposal change" })
  readonly hasChanges?: never;
}

export class DatePlanCheckInDto {
  @IsIn(DATE_SAFETY_STATUS_VALUES)
  readonly safetyStatus!: DateSafetyStatusValue;
}

export class PostDateResponseDto {
  @IsBoolean()
  readonly wantsToMeetAgain!: boolean;
}

export interface DatePlanResponseSummaryDto {
  userId: string;
  response: "ACCEPTED" | "DECLINED" | "COUNTERED";
  proposalVersion: number;
  respondedAt: string;
}

export interface DatePlanDto {
  eventId?: string | null;
  eventVersion?: number | null;
  eventChanged?: boolean;
  eventUnavailable?: boolean;

  id: string;
  matchId: string;
  createdByUserId: string;
  status: DatePlanStatusValue;
  proposalVersion: number;
  title: string;
  description: string;
  activityType: string;
  proposedStartAt: string;
  durationMinutes: number;
  timezone: string;
  publicLocality: string;
  venueName: string | null;
  venuePhotoUrl: string | null;
  venueAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  exactVenueVisibleAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  responses: DatePlanResponseSummaryDto[];
  mySafetyStatus: DateSafetyStatusValue | null;
  myPostDateResponseSubmitted: boolean;
  meetAgainOutcome: "MUTUAL" | "NOT_MUTUAL" | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatePlanResponseDto {
  datePlan: DatePlanDto;
}

export interface DatePlanPageDto {
  items: DatePlanDto[];
  nextCursor: string | null;
}
