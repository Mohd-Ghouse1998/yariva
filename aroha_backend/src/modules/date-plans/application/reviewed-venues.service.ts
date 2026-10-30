import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import planningConfig from "../../../config/planning.config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { Prisma } from "../../../generated/prisma/client";
import type { Coordinate } from "../domain/venue-geography";
import type {
  VenueSearchQueryDto,
  VenueCategoryValue,
  VenueSuggestionDto,
  VenueSuggestionsResponseDto,
} from "../dto/date-plans.dto";

export interface VenueCatalogConstraints {
  id?: string;
  city?: string;
  area?: string;
  maxPricePaise?: number;
  realOnly?: boolean;
}

@Injectable()
export class ReviewedVenuesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(planningConfig.KEY)
    private readonly planning: ConfigType<typeof planningConfig>,
  ) {}
  // Relationship authorization stays with the caller; coordinates never leave this service.
  async search(
    query: VenueSearchQueryDto,
    searchPoint: Coordinate | null,
    constraints: VenueCatalogConstraints = {},
  ): Promise<VenueSuggestionsResponseDto> {
    if (!this.planning.venueSuggestionsEnabled)
      return { items: [], manualFallbackAvailable: true };
    const locationMode = query.locationMode ?? "MIDPOINT";
    const areaSearch =
      locationMode === "AREA"
        ? (query.area?.trim().toLocaleLowerCase() ?? "")
        : "";
    if (locationMode !== "AREA" && !searchPoint) {
      return { items: [], manualFallbackAvailable: true };
    }
    if (locationMode === "AREA" && !areaSearch && !constraints.id) {
      return { items: [], manualFallbackAvailable: true };
    }

    const searchText = query.query?.trim().toLocaleLowerCase() ?? "";
    const category = query.category ?? null;
    const centerLatitude = searchPoint?.latitude ?? null;
    const centerLongitude = searchPoint?.longitude ?? null;
    const rows = await this.prisma.$queryRaw<VenueQueryRow[]>(Prisma.sql`
      SELECT
        "id", "name", "photoUrl", "photoRights", "address", "publicLocality", "reviewSource", "reviewedAt",
        "operationalStatus"::text AS "operationalStatus", "category"::text AS "category",
        "priceMinPerPerson", "priceMaxPerPerson", "currency", "rating", "ratingCount", "accessibilityFacts", "atmosphereTags", "isSynthetic",
        CASE
          WHEN ${centerLatitude}::double precision IS NULL THEN NULL
          ELSE ROUND((ST_Distance(
            "locationPoint",
            ST_SetSRID(ST_MakePoint(${centerLongitude}, ${centerLatitude}), 4326)::geography
          ) / 1000.0)::numeric, 1)::double precision
        END AS "distanceKm"
      FROM "ReviewedVenue"
      WHERE "reviewStatus" = 'REVIEWED'::"VenueReviewStatus"
        AND "operationalStatus" <> 'CLOSED'::"VenueOperationalStatus"
        AND "deletedAt" IS NULL
        AND (${constraints.id ?? null}::uuid IS NULL OR "id" = ${constraints.id ?? null}::uuid)
        AND (${constraints.city ?? null}::text IS NULL OR LOWER("city") = LOWER(${constraints.city ?? null}))
        AND (${constraints.area ?? ""} = '' OR POSITION(LOWER(${constraints.area ?? ""}) IN LOWER("publicLocality")) > 0)
        AND (${constraints.realOnly ?? false}::boolean = false OR (
          "isSynthetic" = false AND length(trim("reviewSource")) > 0 AND "reviewedAt" IS NOT NULL
          AND "reviewedAt" <= CURRENT_TIMESTAMP
          AND "reviewedAt" >= CURRENT_TIMESTAMP - ${this.planning.venueReviewMaxAgeDays} * interval '1 day'
          AND "category" IN ('CAFE', 'RESTAURANT')
        ))
        AND (${constraints.maxPricePaise ?? null}::integer IS NULL OR (
          "currency" = 'INR' AND "priceMaxPerPerson"::bigint * 100 <= ${constraints.maxPricePaise ?? null}
        ))
        AND (${category}::text IS NULL OR "category"::text = ${category})
        AND (
          ${searchText} = ''
          OR POSITION(${searchText} IN LOWER("name")) > 0
          OR POSITION(${searchText} IN LOWER("address")) > 0
          OR POSITION(${searchText} IN LOWER("publicLocality")) > 0
        )
        AND (
          ${areaSearch} = ''
          OR POSITION(${areaSearch} IN LOWER("publicLocality")) > 0
          OR POSITION(${areaSearch} IN LOWER("city")) > 0
          OR POSITION(${areaSearch} IN LOWER("address")) > 0
        )
        AND (
          ${centerLatitude}::double precision IS NULL
          OR ST_DWithin(
            "locationPoint",
            ST_SetSRID(ST_MakePoint(${centerLongitude}, ${centerLatitude}), 4326)::geography,
            ${this.planning.venueRadiusMeters}
          )
        )
      ORDER BY "rating" DESC NULLS LAST, "ratingCount" DESC NULLS LAST, "distanceKm" ASC NULLS LAST, "id"
      LIMIT ${this.planning.maxVenueSuggestions}
    `);

    const items = rows.map((venue): VenueSuggestionDto => ({
      id: venue.id,
      name: venue.name,
      photoUrl: constraints.realOnly && !venue.photoRights?.trim() ? null : venue.photoUrl,
      address: venue.address,
      publicLocality: venue.publicLocality,
      reviewLabel: "Venue details reviewed",
      reviewSource: venue.reviewSource,
      reviewedAt: venue.reviewedAt?.toISOString() ?? null,
      availability: venue.operationalStatus === "OPEN" ? "OPEN" : "UNKNOWN",
      category: venue.category,
      priceTier: toPriceTier(venue.priceMaxPerPerson),
      ...(constraints.realOnly
        ? {
            priceMinPerPerson: venue.priceMinPerPerson,
            priceMaxPerPerson: venue.priceMaxPerPerson,
            currency: venue.currency,
          }
        : {}),
      rating: venue.rating == null ? null : Number(venue.rating),
      ratingCount: venue.ratingCount,
      distanceKm: locationMode === "ME" ? venue.distanceKm : null,
      accessibilityFacts: venue.accessibilityFacts,
      atmosphereTags: venue.atmosphereTags,
      isSynthetic: venue.isSynthetic,
    }));
    return { items, manualFallbackAvailable: true };
  }
}

type VenueQueryRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  photoRights: string | null;
  address: string;
  publicLocality: string;
  reviewSource: string | null;
  reviewedAt: Date | null;
  operationalStatus: "OPEN" | "CLOSED" | "UNKNOWN";
  category: VenueCategoryValue | "OTHER";
  priceMinPerPerson: number | null;
  priceMaxPerPerson: number | null;
  currency: string;
  rating: Prisma.Decimal | number | null;
  ratingCount: number | null;
  distanceKm: number | null;
  accessibilityFacts: string[];
  atmosphereTags: string[];
  isSynthetic: boolean;
};

function toPriceTier(
  priceMaxPerPerson: number | null,
): "₹" | "₹₹" | "₹₹₹" | null {
  if (priceMaxPerPerson == null) return null;
  if (priceMaxPerPerson <= 400) return "₹";
  if (priceMaxPerPerson <= 900) return "₹₹";
  return "₹₹₹";
}
