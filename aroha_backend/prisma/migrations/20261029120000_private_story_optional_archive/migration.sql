-- Explicit opt-in only: existing and new Stories remain unsaved by default.
ALTER TABLE "PrivateStory" ADD COLUMN "savedAt" TIMESTAMP(3);
-- Posting order supports month grouping and stable keyset pagination.
CREATE INDEX "PrivateStory_saved_owner_posted_idx"
ON "PrivateStory" ("ownerId", "createdAt" DESC, "id" DESC)
WHERE "savedAt" IS NOT NULL AND "deletedAt" IS NULL;
