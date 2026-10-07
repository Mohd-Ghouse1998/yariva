-- Expand dating intent without removing existing user intent data.
ALTER TYPE "ConnectionIntent" ADD VALUE IF NOT EXISTS 'DATING';
ALTER TYPE "ConnectionIntent" ADD VALUE IF NOT EXISTS 'COMMITTED_RELATIONSHIP';
ALTER TYPE "ConnectionIntent" ADD VALUE IF NOT EXISTS 'MARRIAGE_MINDED';

-- Privacy-conscious profile and verification fields.
CREATE TYPE "ProfileVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "RelationshipPace" AS ENUM ('SLOW_AND_STEADY', 'OPEN_TO_EXPLORING', 'INTENTIONAL', 'READY_TO_COMMIT');

ALTER TABLE "UserProfile"
  ADD COLUMN "isIncognito" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hideFromContacts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verificationStatus" "ProfileVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "preferredRelationshipPace" "RelationshipPace",
  ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "foodPreferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "relocationOpenness" VARCHAR(80),
  ADD COLUMN "careerPriority" VARCHAR(80),
  ADD COLUMN "familyInvolvementComfort" VARCHAR(120),
  ADD COLUMN "marriageTimeline" VARCHAR(80),
  ADD COLUMN "childrenPreference" VARCHAR(80),
  ADD COLUMN "religionSpirituality" VARCHAR(120),
  ADD COLUMN "shareSensitiveCompatibility" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promptResponses" JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Calm product notifications for the date journey.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_LIKE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DATE_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DATE_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DATE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DATE_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DATE_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SAFETY_CHECK_IN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MUTUAL_MEET_AGAIN';

CREATE TYPE "DatePlanStatus" AS ENUM ('DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "DatePlanResponseType" AS ENUM ('ACCEPTED', 'DECLINED', 'COUNTERED');
CREATE TYPE "DateSafetyStatus" AS ENUM ('ARRIVED', 'OKAY', 'NEED_HELP', 'LEFT_EARLY');

CREATE TABLE "DatePlan" (
  "id" UUID NOT NULL,
  "matchId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "status" "DatePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "proposalVersion" INTEGER NOT NULL DEFAULT 1,
  "title" VARCHAR(140) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "activityType" VARCHAR(80) NOT NULL,
  "proposedStartAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "publicLocality" VARCHAR(160) NOT NULL,
  "venueName" VARCHAR(200),
  "venueAddress" VARCHAR(500),
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "exactVenueVisibleAt" TIMESTAMP(3),
  "estimatedCostMin" INTEGER,
  "estimatedCostMax" INTEGER,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "idempotencyKey" VARCHAR(128),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DatePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DatePlanResponse" (
  "id" UUID NOT NULL,
  "datePlanId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "proposalVersion" INTEGER NOT NULL,
  "response" "DatePlanResponseType" NOT NULL,
  "counterProposal" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DatePlanResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostDateCheckIn" (
  "id" UUID NOT NULL,
  "datePlanId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "safetyStatus" "DateSafetyStatus",
  "wantsToMeetAgain" BOOLEAN,
  "safetySubmittedAt" TIMESTAMP(3),
  "postDateSubmittedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostDateCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatePlan_matchId_createdByUserId_idempotencyKey_key" ON "DatePlan"("matchId", "createdByUserId", "idempotencyKey");
CREATE INDEX "DatePlan_matchId_status_proposedStartAt_idx" ON "DatePlan"("matchId", "status", "proposedStartAt");
CREATE INDEX "DatePlan_createdByUserId_createdAt_idx" ON "DatePlan"("createdByUserId", "createdAt");
CREATE INDEX "DatePlan_status_proposedStartAt_idx" ON "DatePlan"("status", "proposedStartAt");

CREATE UNIQUE INDEX "DatePlanResponse_datePlanId_userId_proposalVersion_key" ON "DatePlanResponse"("datePlanId", "userId", "proposalVersion");
CREATE INDEX "DatePlanResponse_userId_createdAt_idx" ON "DatePlanResponse"("userId", "createdAt");
CREATE INDEX "DatePlanResponse_datePlanId_proposalVersion_idx" ON "DatePlanResponse"("datePlanId", "proposalVersion");

CREATE UNIQUE INDEX "PostDateCheckIn_datePlanId_userId_key" ON "PostDateCheckIn"("datePlanId", "userId");
CREATE INDEX "PostDateCheckIn_userId_submittedAt_idx" ON "PostDateCheckIn"("userId", "submittedAt");
CREATE INDEX "PostDateCheckIn_datePlanId_idx" ON "PostDateCheckIn"("datePlanId");

ALTER TABLE "DatePlan" ADD CONSTRAINT "DatePlan_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlan" ADD CONSTRAINT "DatePlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlanResponse" ADD CONSTRAINT "DatePlanResponse_datePlanId_fkey" FOREIGN KEY ("datePlanId") REFERENCES "DatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DatePlanResponse" ADD CONSTRAINT "DatePlanResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostDateCheckIn" ADD CONSTRAINT "PostDateCheckIn_datePlanId_fkey" FOREIGN KEY ("datePlanId") REFERENCES "DatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostDateCheckIn" ADD CONSTRAINT "PostDateCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
