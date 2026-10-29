export const EVENT_CATEGORIES = ["CULTURE", "MUSIC", "FOOD", "OUTDOORS", "WORKSHOP", "COMMUNITY"] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];

export interface EventListingDto {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
  title: string;
  description: string;
  category: EventCategory;
  city: string;
  locality: string;
  venueName: string;
  venueAddress: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  priceMinPaise: number | null;
  priceMaxPaise: number | null;
  currency: string;
  sourceUrl: string;
  sourceName: string;
  bookingUrl: string | null;
  imageUrl: string | null;
  verifiedAt: string;
  saved: boolean;
  unavailable: boolean;
}

export interface EventQuery {
  city: string;
  area?: string;
  category?: EventCategory;
  from?: string;
  until?: string;
  maxPricePaise?: number;
  saved?: "true" | "false";
  cursor?: string;
  limit?: number;
}

export interface EventPageDto {
  items: EventListingDto[];
  nextCursor: string | null;
}
