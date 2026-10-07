ALTER TABLE "VibeMedia"
  ADD COLUMN "moderationProvider" VARCHAR(80),
  ADD COLUMN "moderationReason" VARCHAR(500),
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "processingCompletedAt" TIMESTAMP(3);

CREATE INDEX "VibeMedia_moderationStatus_status_updatedAt_idx"
  ON "VibeMedia"("moderationStatus", "status", "updatedAt");
