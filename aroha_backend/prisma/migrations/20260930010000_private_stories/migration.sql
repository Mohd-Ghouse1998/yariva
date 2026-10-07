CREATE TABLE "PrivateFollow" (
  "requesterId" UUID NOT NULL, "ownerId" UUID NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateFollow_pkey" PRIMARY KEY ("requesterId","ownerId"),
  CONSTRAINT "PrivateFollow_distinct_check" CHECK ("requesterId" <> "ownerId"),
  CONSTRAINT "PrivateFollow_status_check" CHECK ("status" IN ('PENDING','APPROVED'))
);
CREATE INDEX "PrivateFollow_ownerId_status_idx" ON "PrivateFollow"("ownerId","status");
ALTER TABLE "PrivateFollow" ADD CONSTRAINT "PrivateFollow_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivateFollow" ADD CONSTRAINT "PrivateFollow_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivateCommunityPreference" (
  "userId" UUID NOT NULL PRIMARY KEY,
  "identifyAs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "connectWith" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "optedInCommunities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selfDescription" VARCHAR(120),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "PrivateCommunityPreference" ADD CONSTRAINT "PrivateCommunityPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivateStory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ownerId" UUID NOT NULL,
  "text" VARCHAR(2000) NOT NULL, "audienceRule" VARCHAR(16) NOT NULL,
  "communityFilter" VARCHAR(32), "expiresAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateStory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateStory_audienceRule_check" CHECK ("audienceRule" IN ('SELECTED','ALL_APPROVED')),
  CONSTRAINT "PrivateStory_text_check" CHECK (length(trim("text")) > 0)
);
CREATE INDEX "PrivateStory_ownerId_createdAt_id_idx" ON "PrivateStory"("ownerId","createdAt" DESC,"id" DESC);
CREATE INDEX "PrivateStory_expiresAt_deletedAt_idx" ON "PrivateStory"("expiresAt","deletedAt");
ALTER TABLE "PrivateStory" ADD CONSTRAINT "PrivateStory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivateStoryGrant" (
  "storyId" UUID NOT NULL, "recipientId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateStoryGrant_pkey" PRIMARY KEY ("storyId","recipientId")
);
CREATE INDEX "PrivateStoryGrant_recipientId_storyId_idx" ON "PrivateStoryGrant"("recipientId","storyId");
ALTER TABLE "PrivateStoryGrant" ADD CONSTRAINT "PrivateStoryGrant_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "PrivateStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateStoryGrant" ADD CONSTRAINT "PrivateStoryGrant_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
