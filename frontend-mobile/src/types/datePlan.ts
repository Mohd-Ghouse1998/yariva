export type DatePlanStatus =
  | "DRAFT"
  | "PROPOSED"
  | "COUNTERED"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED";

export type DateSafetyStatus = "ARRIVED" | "OKAY" | "NEED_HELP" | "LEFT_EARLY";
export type VenueCategory = "CAFE" | "RESTAURANT" | "ACTIVITY";
export type VenueLocationMode = "MIDPOINT" | "ME" | "AREA";

export interface CreateDatePlanRequest {
  reviewedVenueId?: string | null;
  title: string;
  description: string;
  activityType: string;
  proposedStartAt: string;
  durationMinutes: number;
  timezone: string;
  publicLocality: string;
  venueName?: string | null;
  venueAddress?: string | null;
  idempotencyKey?: string;
}

export type CounterDatePlanRequest = Partial<
  Omit<CreateDatePlanRequest, "idempotencyKey">
>;

export interface VenueSuggestion {
  id: string;
  name: string;
  photoUrl: string | null;
  address: string;
  publicLocality: string;
  reviewLabel: "Venue details reviewed";
  reviewSource: string | null;
  reviewedAt: string | null;
  availability: "OPEN" | "UNKNOWN";
  category: VenueCategory | "OTHER";
  priceTier: "₹" | "₹₹" | "₹₹₹" | null;
  rating: number | null;
  ratingCount: number | null;
  distanceKm: number | null;
  accessibilityFacts: string[];
  atmosphereTags: string[];
  isSynthetic: boolean;
}

export interface VenueSuggestionsResponse {
  items: VenueSuggestion[];
  manualFallbackAvailable: true;
}

export interface DatePlanDto {
  id: string;
  matchId: string;
  createdByUserId: string;
  status: DatePlanStatus;
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
  responses: Array<{
    userId: string;
    response: "ACCEPTED" | "DECLINED" | "COUNTERED";
    proposalVersion: number;
    respondedAt: string;
  }>;
  mySafetyStatus: DateSafetyStatus | null;
  myPostDateResponseSubmitted: boolean;
  meetAgainOutcome: "MUTUAL" | "NOT_MUTUAL" | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatePlanPageDto {
  items: DatePlanDto[];
  nextCursor: string | null;
}
