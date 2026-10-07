CREATE TYPE "VibeMediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'REJECTED', 'FAILED', 'REMOVED');
CREATE TYPE "VibeFilter" AS ENUM ('ORIGINAL', 'WARM', 'COOL', 'MONO', 'POP');
CREATE TYPE "VibeAudioMode" AS ENUM ('ORIGINAL', 'MUTED', 'CUSTOM');

CREATE TABLE "VibeMedia" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" "VibeMediaStatus" NOT NULL DEFAULT 'UPLOADING',
  "filter" "VibeFilter" NOT NULL DEFAULT 'ORIGINAL',
  "audioMode" "VibeAudioMode" NOT NULL DEFAULT 'ORIGINAL',
  "sourceBucket" VARCHAR(128) NOT NULL,
  "sourceObjectKey" VARCHAR(512) NOT NULL,
  "sourceMimeType" VARCHAR(128) NOT NULL,
  "sourceSizeBytes" INTEGER NOT NULL,
  "sourceUploadTokenHash" VARCHAR(64) NOT NULL,
  "musicBucket" VARCHAR(128),
  "musicObjectKey" VARCHAR(512),
  "musicMimeType" VARCHAR(128),
  "musicSizeBytes" INTEGER,
  "musicName" VARCHAR(180),
  "musicUploadTokenHash" VARCHAR(64),
  "processedBucket" VARCHAR(128),
  "processedObjectKey" VARCHAR(512),
  "processedMimeType" VARCHAR(128),
  "processedSizeBytes" INTEGER,
  "thumbnailBucket" VARCHAR(128),
  "thumbnailObjectKey" VARCHAR(512),
  "durationMs" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "videoCodec" VARCHAR(64),
  "audioCodec" VARCHAR(64),
  "moderationStatus" "PhotoModerationStatus" NOT NULL DEFAULT 'PENDING',
  "failureReason" VARCHAR(500),
  "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
  "readyAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VibeMedia_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VibeMedia"
  ADD CONSTRAINT "VibeMedia_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "VibeMedia_userId_status_deletedAt_createdAt_idx"
  ON "VibeMedia"("userId", "status", "deletedAt", "createdAt");
CREATE INDEX "VibeMedia_status_updatedAt_idx" ON "VibeMedia"("status", "updatedAt");
