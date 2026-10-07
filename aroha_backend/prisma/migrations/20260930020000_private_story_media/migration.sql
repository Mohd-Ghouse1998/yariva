ALTER TABLE "PrivateStory"
  ALTER COLUMN "text" SET DEFAULT '',
  ADD COLUMN "mediaBucket" VARCHAR(128),
  ADD COLUMN "mediaObjectKey" VARCHAR(512),
  ADD COLUMN "mediaMimeType" VARCHAR(64),
  ADD COLUMN "mediaSizeBytes" INTEGER;
ALTER TABLE "PrivateStory" ADD CONSTRAINT "PrivateStory_media_consistent_check" CHECK (
  ("mediaBucket" IS NULL AND "mediaObjectKey" IS NULL AND "mediaMimeType" IS NULL AND "mediaSizeBytes" IS NULL)
  OR ("mediaBucket" IS NOT NULL AND "mediaObjectKey" IS NOT NULL AND "mediaMimeType" IS NOT NULL AND "mediaSizeBytes" > 0)
);
ALTER TABLE "PrivateStory" ADD CONSTRAINT "PrivateStory_content_check" CHECK (length(trim("text")) > 0 OR "mediaObjectKey" IS NOT NULL);
