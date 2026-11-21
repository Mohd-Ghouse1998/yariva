-- CreateEnum
CREATE TYPE "CircleStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CircleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'REMOVED');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "circleId" UUID;

-- CreateTable
CREATE TABLE "Circle" (
    "id" UUID NOT NULL,
    "organizerId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "intent" "ConnectionIntent" NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "region" VARCHAR(120) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "CircleStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMembership" (
    "circleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "CircleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleMembership_pkey" PRIMARY KEY ("circleId","userId")
);

-- CreateTable
CREATE TABLE "CircleActivity" (
    "id" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "venueId" UUID,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "openToNearby" BOOLEAN NOT NULL DEFAULT false,
    "helpNeeds" TEXT[],
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleActivityResponse" (
    "activityId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "need" INTEGER NOT NULL,
    "status" "CircleRequestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "CircleActivityResponse_pkey" PRIMARY KEY ("activityId","userId","need")
);

-- CreateTable
CREATE TABLE "ConversationCheckIn" (
    "conversationId" UUID NOT NULL,
    "intentVersion" INTEGER NOT NULL DEFAULT 0,
    "lowIntent" "ConnectionIntent",
    "highIntent" "ConnectionIntent",
    "vibeVersion" INTEGER NOT NULL DEFAULT 0,
    "vibeInviterId" UUID,
    "vibeAccepted" BOOLEAN NOT NULL DEFAULT false,
    "lowAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highAnswers" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ConversationCheckIn_pkey" PRIMARY KEY ("conversationId")
);

-- CreateIndex
CREATE INDEX "Circle_countryCode_city_region_status_expiresAt_idx" ON "Circle"("countryCode", "city", "region", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Circle_organizerId_status_idx" ON "Circle"("organizerId", "status");

-- CreateIndex
CREATE INDEX "CircleMembership_userId_status_idx" ON "CircleMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "CircleMembership_circleId_status_idx" ON "CircleMembership"("circleId", "status");

-- CreateIndex
CREATE INDEX "CircleActivity_circleId_expiresAt_idx" ON "CircleActivity"("circleId", "expiresAt");

-- CreateIndex
CREATE INDEX "CircleActivity_openToNearby_expiresAt_idx" ON "CircleActivity"("openToNearby", "expiresAt");

-- CreateIndex
CREATE INDEX "CircleActivityResponse_activityId_need_status_idx" ON "CircleActivityResponse"("activityId", "need", "status");

-- CreateIndex
CREATE INDEX "CircleActivityResponse_userId_status_idx" ON "CircleActivityResponse"("userId", "status");

-- CreateIndex
CREATE INDEX "Conversation_circleId_status_idx" ON "Conversation"("circleId", "status");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMembership" ADD CONSTRAINT "CircleMembership_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMembership" ADD CONSTRAINT "CircleMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleActivity" ADD CONSTRAINT "CircleActivity_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleActivityResponse" ADD CONSTRAINT "CircleActivityResponse_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CircleActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleActivityResponse" ADD CONSTRAINT "CircleActivityResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationCheckIn" ADD CONSTRAINT "ConversationCheckIn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CircleActivity" ADD CONSTRAINT "CircleActivity_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "ReviewedVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A conversation has exactly one subject. Circle roster snapshots keep independent history.
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_one_subject",
  ADD CONSTRAINT "Conversation_one_subject" CHECK (num_nonnulls("matchId", "duoMatchId", "circleId") = 1);
CREATE UNIQUE INDEX "Conversation_active_circle" ON "Conversation" ("circleId")
  WHERE "circleId" IS NOT NULL AND status = 'ACTIVE';

ALTER TABLE "Circle" ADD CONSTRAINT "Circle_capacity_range" CHECK (capacity BETWEEN 4 AND 6);
ALTER TABLE "CircleActivity" ADD CONSTRAINT "CircleActivity_limits"
  CHECK (capacity BETWEEN 1 AND 6 AND COALESCE(cardinality("helpNeeds"), 0) BETWEEN 0 AND 3 AND version > 0);
ALTER TABLE "CircleActivityResponse" ADD CONSTRAINT "CircleActivityResponse_need_range" CHECK (need BETWEEN 0 AND 3);

INSERT INTO "FeatureFlag"(id, key, description, enabled, "updatedAt") VALUES
  (gen_random_uuid(), 'social.circles', 'Small circles and nearby activities', false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'social.connection_check_in', 'Optional intent and shared prompts in existing conversations', false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'social.first_connections', 'First connections in Discover', false, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
