-- Additive pilot follow-up. Existing event instants are UTC, as encoded by Prisma.
ALTER TABLE "EventListing"
  ADD COLUMN "latitude" DECIMAL(9,6), ADD COLUMN "longitude" DECIMAL(9,6),
  ADD COLUMN "locationPoint" geography(Point,4326),
  ALTER COLUMN "startsAt" TYPE timestamptz(3) USING "startsAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "endsAt" TYPE timestamptz(3) USING "endsAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "verifiedAt" TYPE timestamptz(3) USING "verifiedAt" AT TIME ZONE 'UTC';
ALTER TABLE "EventListing" ADD CONSTRAINT "EventListing_coordinates_check" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL) OR
  ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
);
CREATE FUNCTION sync_event_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."locationPoint" := CASE WHEN NEW."latitude" IS NULL THEN NULL ELSE
    ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"),4326)::geography END;
  RETURN NEW;
END; $$;
CREATE TRIGGER event_location_sync BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "EventListing"
  FOR EACH ROW EXECUTE FUNCTION sync_event_location();
CREATE INDEX "EventListing_locationPoint_idx" ON "EventListing" USING gist("locationPoint");
ALTER TYPE "ReportTargetType" ADD VALUE 'EVENT_LISTING';
ALTER TABLE "Report" ALTER COLUMN "reportedUserId" DROP NOT NULL, ADD COLUMN "targetEventId" UUID;
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetEventId_fkey" FOREIGN KEY ("targetEventId") REFERENCES "EventListing"("id") ON DELETE RESTRICT;
CREATE INDEX "Report_targetEventId_idx" ON "Report"("targetEventId");
-- Cast to text allows the newly added enum value in the same migration transaction.
ALTER TABLE "Report" ADD CONSTRAINT "Report_subject_check" CHECK (
  ("targetType"::text = 'EVENT_LISTING' AND "targetEventId" IS NOT NULL AND "reportedUserId" IS NULL) OR
  ("targetType"::text <> 'EVENT_LISTING' AND "targetEventId" IS NULL AND "reportedUserId" IS NOT NULL)
);
ALTER TABLE "ModerationCase" ALTER COLUMN "subjectUserId" DROP NOT NULL;
