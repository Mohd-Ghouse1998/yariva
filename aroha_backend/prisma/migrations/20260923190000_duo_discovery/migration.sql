CREATE TYPE "WingmanVoteDecision" AS ENUM ('APPROVE', 'PASS');
CREATE TYPE "WingmanPairMatchStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "WingmanPairMatch" (
  "id" UUID NOT NULL,
  "partyLowId" UUID NOT NULL,
  "partyHighId" UUID NOT NULL,
  "partyLowMembershipVersion" INTEGER NOT NULL,
  "partyHighMembershipVersion" INTEGER NOT NULL,
  "status" "WingmanPairMatchStatus" NOT NULL DEFAULT 'ACTIVE',
  "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WingmanPairMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WingmanPairMatch_distinct_parties_check" CHECK ("partyLowId" <> "partyHighId"),
  CONSTRAINT "WingmanPairMatch_canonical_order_check" CHECK ("partyLowId"::text < "partyHighId"::text)
);

CREATE TABLE "WingmanPartyVote" (
  "id" UUID NOT NULL,
  "voterUserId" UUID NOT NULL,
  "sourcePartyId" UUID NOT NULL,
  "targetPartyId" UUID NOT NULL,
  "decision" "WingmanVoteDecision" NOT NULL,
  "sourceMembershipVersion" INTEGER NOT NULL,
  "targetMembershipVersion" INTEGER NOT NULL,
  "sourceSceneId" UUID NOT NULL,
  "sourceSceneVersion" INTEGER NOT NULL,
  "targetOwnerSceneId" UUID NOT NULL,
  "targetOwnerSceneVersion" INTEGER NOT NULL,
  "targetBuddySceneId" UUID NOT NULL,
  "targetBuddySceneVersion" INTEGER NOT NULL,
  "pairMatchId" UUID,
  "matchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WingmanPartyVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WingmanPartyVote_distinct_parties_check" CHECK ("sourcePartyId" <> "targetPartyId")
);

CREATE UNIQUE INDEX "WingmanPairMatch_partyLowId_partyHighId_key"
  ON "WingmanPairMatch"("partyLowId", "partyHighId");
CREATE INDEX "WingmanPairMatch_partyLowId_status_matchedAt_idx"
  ON "WingmanPairMatch"("partyLowId", "status", "matchedAt");
CREATE INDEX "WingmanPairMatch_partyHighId_status_matchedAt_idx"
  ON "WingmanPairMatch"("partyHighId", "status", "matchedAt");
CREATE INDEX "WingmanPairMatch_status_matchedAt_idx"
  ON "WingmanPairMatch"("status", "matchedAt");

CREATE UNIQUE INDEX "WingmanPartyVote_sourcePartyId_targetPartyId_voterUserId_key"
  ON "WingmanPartyVote"("sourcePartyId", "targetPartyId", "voterUserId");
CREATE INDEX "WingmanPartyVote_voterUserId_decision_updatedAt_idx"
  ON "WingmanPartyVote"("voterUserId", "decision", "updatedAt");
CREATE INDEX "WingmanPartyVote_sourcePartyId_targetPartyId_decision_idx"
  ON "WingmanPartyVote"("sourcePartyId", "targetPartyId", "decision");
CREATE INDEX "WingmanPartyVote_targetPartyId_sourcePartyId_decision_idx"
  ON "WingmanPartyVote"("targetPartyId", "sourcePartyId", "decision");
CREATE INDEX "WingmanPartyVote_pairMatchId_idx" ON "WingmanPartyVote"("pairMatchId");

ALTER TABLE "WingmanPairMatch" ADD CONSTRAINT "WingmanPairMatch_partyLowId_fkey"
  FOREIGN KEY ("partyLowId") REFERENCES "WingmanParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPairMatch" ADD CONSTRAINT "WingmanPairMatch_partyHighId_fkey"
  FOREIGN KEY ("partyHighId") REFERENCES "WingmanParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_voterUserId_fkey"
  FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_sourcePartyId_fkey"
  FOREIGN KEY ("sourcePartyId") REFERENCES "WingmanParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_targetPartyId_fkey"
  FOREIGN KEY ("targetPartyId") REFERENCES "WingmanParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_sourceSceneId_fkey"
  FOREIGN KEY ("sourceSceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_targetOwnerSceneId_fkey"
  FOREIGN KEY ("targetOwnerSceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_targetBuddySceneId_fkey"
  FOREIGN KEY ("targetBuddySceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WingmanPartyVote" ADD CONSTRAINT "WingmanPartyVote_pairMatchId_fkey"
  FOREIGN KEY ("pairMatchId") REFERENCES "WingmanPairMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
