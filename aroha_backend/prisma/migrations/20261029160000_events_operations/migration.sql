ALTER TABLE "ReviewedVenue" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ReviewedVenue" ADD CONSTRAINT "ReviewedVenue_version_check" CHECK ("version" > 0);
CREATE INDEX "ReviewedVenue_createdAt_id_idx" ON "ReviewedVenue"("createdAt", "id");
CREATE INDEX "EventListing_createdAt_id_idx" ON "EventListing"("createdAt", "id");
CREATE INDEX "DatePlan_eventId_id_idx" ON "DatePlan"("eventId", "id");
CREATE TABLE "EventChangeNotice" (
  "id" UUID NOT NULL PRIMARY KEY, "eventId" UUID NOT NULL REFERENCES "EventListing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "eventVersion" INTEGER NOT NULL CHECK ("eventVersion" > 0), "status" "EventListingStatus" NOT NULL,
  "afterPlanId" UUID, "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" timestamptz(3)
);
CREATE UNIQUE INDEX "EventChangeNotice_eventId_eventVersion_key" ON "EventChangeNotice"("eventId", "eventVersion");
CREATE INDEX "EventChangeNotice_completedAt_createdAt_id_idx" ON "EventChangeNotice"("completedAt", "createdAt", "id");
