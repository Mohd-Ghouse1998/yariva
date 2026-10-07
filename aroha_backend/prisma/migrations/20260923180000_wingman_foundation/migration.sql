CREATE TYPE "WingmanPartyStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISCONNECTED');
CREATE TYPE "WingmanMembershipRole" AS ENUM ('OWNER', 'BUDDY');
CREATE TYPE "WingmanMembershipStatus" AS ENUM ('RESERVED', 'ACTIVE', 'DISCONNECTED');
CREATE TYPE "WingmanInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "WingmanParty" (
  "id" UUID NOT NULL,
  "status" "WingmanPartyStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId" UUID NOT NULL,
  "membershipVersion" INTEGER NOT NULL DEFAULT 1,
  "activatedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WingmanParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WingmanPartyMember" (
  "id" UUID NOT NULL,
  "partyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "WingmanMembershipRole" NOT NULL,
  "status" "WingmanMembershipStatus" NOT NULL,
  "consentedSceneId" UUID,
  "consentedSceneVersion" INTEGER,
  "sceneConsentedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WingmanPartyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WingmanInvitation" (
  "id" UUID NOT NULL,
  "partyId" UUID NOT NULL,
  "inviterUserId" UUID NOT NULL,
  "inviteeUserId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "status" "WingmanInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WingmanInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WingmanPartyMember_partyId_userId_key" ON "WingmanPartyMember"("partyId", "userId");
CREATE INDEX "WingmanPartyMember_userId_status_idx" ON "WingmanPartyMember"("userId", "status");
CREATE INDEX "WingmanPartyMember_partyId_status_idx" ON "WingmanPartyMember"("partyId", "status");
CREATE INDEX "WingmanPartyMember_consentedSceneId_idx" ON "WingmanPartyMember"("consentedSceneId");

-- This partial unique index is the database-level concurrency guard that keeps
-- one person from being reserved or active in multiple Wingman parties.
CREATE UNIQUE INDEX "WingmanPartyMember_one_current_party_per_user"
  ON "WingmanPartyMember"("userId")
  WHERE "status" IN ('RESERVED', 'ACTIVE');

CREATE INDEX "WingmanParty_createdByUserId_status_idx" ON "WingmanParty"("createdByUserId", "status");
CREATE INDEX "WingmanParty_status_updatedAt_idx" ON "WingmanParty"("status", "updatedAt");
CREATE UNIQUE INDEX "WingmanInvitation_partyId_key" ON "WingmanInvitation"("partyId");
CREATE UNIQUE INDEX "WingmanInvitation_tokenHash_key" ON "WingmanInvitation"("tokenHash");
CREATE INDEX "WingmanInvitation_inviteeUserId_status_expiresAt_idx" ON "WingmanInvitation"("inviteeUserId", "status", "expiresAt");
CREATE INDEX "WingmanInvitation_inviterUserId_status_expiresAt_idx" ON "WingmanInvitation"("inviterUserId", "status", "expiresAt");
CREATE INDEX "WingmanInvitation_status_expiresAt_idx" ON "WingmanInvitation"("status", "expiresAt");

ALTER TABLE "WingmanParty" ADD CONSTRAINT "WingmanParty_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyMember" ADD CONSTRAINT "WingmanPartyMember_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "WingmanParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyMember" ADD CONSTRAINT "WingmanPartyMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyMember" ADD CONSTRAINT "WingmanPartyMember_consentedSceneId_fkey"
  FOREIGN KEY ("consentedSceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WingmanInvitation" ADD CONSTRAINT "WingmanInvitation_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "WingmanParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanInvitation" ADD CONSTRAINT "WingmanInvitation_inviterUserId_fkey"
  FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanInvitation" ADD CONSTRAINT "WingmanInvitation_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
