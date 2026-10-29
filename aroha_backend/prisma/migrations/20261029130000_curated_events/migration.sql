CREATE TYPE "EventListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "EventCategory" AS ENUM ('CULTURE', 'MUSIC', 'FOOD', 'OUTDOORS', 'WORKSHOP', 'COMMUNITY');
CREATE TABLE "EventListing" (
  "id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "status" "EventListingStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(140) NOT NULL, "description" VARCHAR(1000) NOT NULL,
  "category" "EventCategory" NOT NULL, "city" VARCHAR(120) NOT NULL,
  "locality" VARCHAR(160) NOT NULL, "venueName" VARCHAR(200) NOT NULL,
  "venueAddress" VARCHAR(500) NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL, "timezone" VARCHAR(64) NOT NULL,
  "priceMinPaise" INTEGER, "priceMaxPaise" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR', "sourceUrl" VARCHAR(1024) NOT NULL,
  "sourceName" VARCHAR(120) NOT NULL, "bookingUrl" VARCHAR(1024),
  "imageUrl" VARCHAR(1024), "imageRights" VARCHAR(500),
  "verifiedAt" TIMESTAMP(3) NOT NULL, "dedupeKey" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventListing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventListing_schedule_check" CHECK ("endsAt" > "startsAt" AND "endsAt" - "startsAt" <= interval '2147483647 minutes' AND "version" > 0),
  CONSTRAINT "EventListing_prices_check" CHECK (
    ("priceMinPaise" IS NULL AND "priceMaxPaise" IS NULL) OR
    ("priceMinPaise" IS NOT NULL AND "priceMaxPaise" IS NOT NULL AND "priceMinPaise" >= 0 AND "priceMaxPaise" >= "priceMinPaise")
  ),
  CONSTRAINT "EventListing_image_rights_check" CHECK ("imageUrl" IS NULL OR ("imageRights" IS NOT NULL AND length(trim("imageRights")) > 0))
);
CREATE UNIQUE INDEX "EventListing_sourceUrl_startsAt_key" ON "EventListing"("sourceUrl", "startsAt");
CREATE UNIQUE INDEX "EventListing_dedupeKey_key" ON "EventListing"("dedupeKey");
CREATE INDEX "EventListing_status_city_startsAt_id_idx" ON "EventListing"("status", "city", "startsAt", "id");
CREATE INDEX "EventListing_status_verifiedAt_idx" ON "EventListing"("status", "verifiedAt");
CREATE TABLE "SavedEvent" (
  "userId" UUID NOT NULL, "eventId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedEvent_pkey" PRIMARY KEY ("userId", "eventId"),
  CONSTRAINT "SavedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SavedEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventListing"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SavedEvent_eventId_idx" ON "SavedEvent"("eventId");
ALTER TABLE "DatePlan" ADD COLUMN "eventId" UUID, ADD COLUMN "eventVersion" INTEGER, ADD COLUMN "eventSnapshot" JSONB;
ALTER TABLE "DatePlan" ADD CONSTRAINT "DatePlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlan" ADD CONSTRAINT "DatePlan_event_snapshot_check" CHECK (
  ("eventId" IS NULL AND "eventVersion" IS NULL AND "eventSnapshot" IS NULL) OR
  ("eventId" IS NOT NULL AND "eventVersion" IS NOT NULL AND "eventVersion" > 0 AND "eventSnapshot" IS NOT NULL)
);
CREATE INDEX "DatePlan_eventId_idx" ON "DatePlan"("eventId");
-- No public fixtures or enabled rollout flag: launch requires sourced, reviewed listings.
