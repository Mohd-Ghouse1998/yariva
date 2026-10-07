-- The casual-meetup redesign intentionally removes the office-like shared
-- availability/budget workflow and its temporary shortlist records.
DROP TABLE IF EXISTS "DatePlanVenueCandidateShare";
DROP TABLE IF EXISTS "DatePlanPreferenceWindow";
DROP TABLE IF EXISTS "DatePlanPreference";

CREATE TYPE "VenueCategory" AS ENUM ('CAFE', 'RESTAURANT', 'ACTIVITY', 'OTHER');

ALTER TABLE "ReviewedVenue"
ADD COLUMN "category" "VenueCategory" NOT NULL DEFAULT 'OTHER';

CREATE INDEX "ReviewedVenue_category_reviewStatus_operationalStatus_idx"
ON "ReviewedVenue"("category", "reviewStatus", "operationalStatus");
