ALTER TABLE "PrivateStory"
  ADD COLUMN "moderationStatus" "ContentModerationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "moderatedAt" TIMESTAMP(3);

-- Existing text Stories continue through reporting and manual takedown.
-- Media requires explicit review, including previously processed media.
UPDATE "PrivateStory" SET "moderationStatus" = 'APPROVED'
WHERE "mediaObjectKey" IS NULL;

CREATE INDEX "PrivateStory_moderationStatus_createdAt_id_idx"
  ON "PrivateStory"("moderationStatus", "createdAt" DESC, "id" DESC);
