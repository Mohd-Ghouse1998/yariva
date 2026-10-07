CREATE TYPE "VenueReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'REJECTED');
CREATE TYPE "VenueOperationalStatus" AS ENUM ('OPEN', 'CLOSED', 'UNKNOWN');

ALTER TABLE "DatePlan" ADD COLUMN "reviewedVenueId" UUID;

CREATE TABLE "DatePlanPreference" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "matchId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "budgetFlexible" BOOLEAN NOT NULL DEFAULT true,
  "budgetMinPerPerson" INTEGER,
  "budgetMaxPerPerson" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatePlanPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DatePlanPreference_budget_check" CHECK (
    ("budgetFlexible" = true AND "budgetMinPerPerson" IS NULL AND "budgetMaxPerPerson" IS NULL)
    OR
    ("budgetFlexible" = false AND "budgetMinPerPerson" IS NOT NULL AND "budgetMaxPerPerson" IS NOT NULL
      AND "budgetMinPerPerson" >= 0 AND "budgetMaxPerPerson" >= "budgetMinPerPerson")
  )
);

CREATE TABLE "DatePlanPreferenceWindow" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "preferenceId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatePlanPreferenceWindow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DatePlanPreferenceWindow_range_check" CHECK ("startsAt" < "endsAt")
);

CREATE TABLE "ReviewedVenue" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(200) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "publicLocality" VARCHAR(160) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "locationPoint" geography(Point, 4326),
  "reviewStatus" "VenueReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewSource" VARCHAR(200),
  "reviewedAt" TIMESTAMPTZ(3),
  "operationalStatus" "VenueOperationalStatus" NOT NULL DEFAULT 'UNKNOWN',
  "openingHours" JSONB,
  "priceMinPerPerson" INTEGER,
  "priceMaxPerPerson" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "accessibilityFacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "atmosphereTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewedVenue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewedVenue_coordinate_check" CHECK (
    "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
  ),
  CONSTRAINT "ReviewedVenue_price_check" CHECK (
    "priceMinPerPerson" IS NULL OR "priceMaxPerPerson" IS NULL OR "priceMaxPerPerson" >= "priceMinPerPerson"
  ),
  CONSTRAINT "ReviewedVenue_review_check" CHECK (
    "reviewStatus" <> 'REVIEWED' OR ("reviewSource" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  )
);

CREATE TABLE "DatePlanVenueCandidateShare" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "datePlanId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "sharedByUserId" UUID NOT NULL,
  "proposalVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatePlanVenueCandidateShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatePlanPreference_matchId_userId_key" ON "DatePlanPreference"("matchId", "userId");
CREATE INDEX "DatePlanPreference_userId_updatedAt_idx" ON "DatePlanPreference"("userId", "updatedAt");
CREATE INDEX "DatePlanPreference_matchId_updatedAt_idx" ON "DatePlanPreference"("matchId", "updatedAt");
CREATE INDEX "DatePlanPreferenceWindow_preferenceId_startsAt_idx" ON "DatePlanPreferenceWindow"("preferenceId", "startsAt");
CREATE INDEX "ReviewedVenue_reviewStatus_operationalStatus_deletedAt_idx" ON "ReviewedVenue"("reviewStatus", "operationalStatus", "deletedAt");
CREATE INDEX "ReviewedVenue_city_publicLocality_idx" ON "ReviewedVenue"("city", "publicLocality");
CREATE INDEX "ReviewedVenue_locationPoint_gist" ON "ReviewedVenue" USING GIST ("locationPoint");
CREATE UNIQUE INDEX "DatePlanVenueCandidateShare_datePlanId_venueId_proposalVersion_key" ON "DatePlanVenueCandidateShare"("datePlanId", "venueId", "proposalVersion");
CREATE INDEX "DatePlanVenueCandidateShare_datePlanId_proposalVersion_createdAt_idx" ON "DatePlanVenueCandidateShare"("datePlanId", "proposalVersion", "createdAt");
CREATE INDEX "DatePlanVenueCandidateShare_sharedByUserId_createdAt_idx" ON "DatePlanVenueCandidateShare"("sharedByUserId", "createdAt");
CREATE INDEX "DatePlan_reviewedVenueId_idx" ON "DatePlan"("reviewedVenueId");

ALTER TABLE "DatePlanPreference" ADD CONSTRAINT "DatePlanPreference_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlanPreference" ADD CONSTRAINT "DatePlanPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlanPreferenceWindow" ADD CONSTRAINT "DatePlanPreferenceWindow_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "DatePlanPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatePlan" ADD CONSTRAINT "DatePlan_reviewedVenueId_fkey" FOREIGN KEY ("reviewedVenueId") REFERENCES "ReviewedVenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DatePlanVenueCandidateShare" ADD CONSTRAINT "DatePlanVenueCandidateShare_datePlanId_fkey" FOREIGN KEY ("datePlanId") REFERENCES "DatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlanVenueCandidateShare" ADD CONSTRAINT "DatePlanVenueCandidateShare_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ReviewedVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlanVenueCandidateShare" ADD CONSTRAINT "DatePlanVenueCandidateShare_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION sync_reviewed_venue_location_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW."locationPoint" := ST_SetSRID(ST_MakePoint(NEW."longitude"::double precision, NEW."latitude"::double precision), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ReviewedVenue_location_point_sync"
BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "ReviewedVenue"
FOR EACH ROW EXECUTE FUNCTION sync_reviewed_venue_location_point();

-- Synthetic venues are intentionally excluded from this production migration.
-- The explicit demo seed owns visibly labelled local/test records.
