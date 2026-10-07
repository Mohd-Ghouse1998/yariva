-- Additive subjects keep solo messages, reads, attachments and moderation intact.
ALTER TABLE "Conversation" ALTER COLUMN "matchId" DROP NOT NULL;
ALTER TABLE "Conversation" ADD COLUMN "duoMatchId" UUID;
CREATE UNIQUE INDEX "Conversation_duoMatchId_key" ON "Conversation"("duoMatchId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_duoMatchId_fkey" FOREIGN KEY ("duoMatchId") REFERENCES "WingmanPairMatch"("id") ON DELETE RESTRICT;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_one_subject" CHECK (("matchId" IS NULL) <> ("duoMatchId" IS NULL));
CREATE TABLE "ConversationMember" (
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("conversationId", "userId")
);
CREATE INDEX "ConversationMember_userId_conversationId_idx" ON "ConversationMember"("userId", "conversationId");
INSERT INTO "ConversationMember" ("conversationId", "userId")
SELECT c.id, m."userLowId" FROM "Conversation" c JOIN "Match" m ON m.id=c."matchId"
UNION ALL SELECT c.id, m."userHighId" FROM "Conversation" c JOIN "Match" m ON m.id=c."matchId";
-- Existing paired matches did not yet have private group messages. Snapshot only current membership.
INSERT INTO "Conversation" ("id", "duoMatchId", "updatedAt")
SELECT gen_random_uuid(), m.id, CURRENT_TIMESTAMP FROM "WingmanPairMatch" m
JOIN "WingmanParty" a ON a.id=m."partyLowId" JOIN "WingmanParty" b ON b.id=m."partyHighId"
WHERE m.status='ACTIVE' AND a.status='ACTIVE' AND b.status='ACTIVE'
AND a."membershipVersion"=m."partyLowMembershipVersion" AND b."membershipVersion"=m."partyHighMembershipVersion"
AND (SELECT count(DISTINCT pm."userId") FROM "WingmanPartyMember" pm
  WHERE pm."partyId" IN (a.id,b.id) AND pm.status='ACTIVE')=4;
INSERT INTO "ConversationMember" ("conversationId", "userId")
SELECT c.id, pm."userId" FROM "Conversation" c JOIN "WingmanPairMatch" m ON m.id=c."duoMatchId"
JOIN "WingmanPartyMember" pm ON pm."partyId" IN (m."partyLowId", m."partyHighId") WHERE pm.status='ACTIVE';
INSERT INTO "ConversationRead" (id, "conversationId", "userId", "updatedAt")
SELECT gen_random_uuid(), cm."conversationId", cm."userId", CURRENT_TIMESTAMP FROM "ConversationMember" cm
JOIN "Conversation" c ON c.id=cm."conversationId" WHERE c."duoMatchId" IS NOT NULL;
CREATE TABLE "DuoPlan" (
  id UUID PRIMARY KEY,
  "conversationId" UUID NOT NULL REFERENCES "Conversation"(id) ON DELETE RESTRICT,
  "createdByUserId" UUID NOT NULL,
  status "DatePlanStatus" NOT NULL DEFAULT 'PROPOSED', version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  activity VARCHAR(140) NOT NULL, "venueName" VARCHAR(200) NOT NULL, "publicLocality" VARCHAR(160) NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("conversationId", "createdByUserId") REFERENCES "ConversationMember"("conversationId", "userId") ON DELETE RESTRICT
);
CREATE INDEX "DuoPlan_conversationId_createdAt_idx" ON "DuoPlan"("conversationId", "createdAt");
CREATE UNIQUE INDEX "DuoPlan_one_open" ON "DuoPlan"("conversationId") WHERE status IN ('PROPOSED','COUNTERED','ACCEPTED');
CREATE TABLE "DuoPlanResponse" (
  "planId" UUID NOT NULL REFERENCES "DuoPlan"(id) ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version>0), response "DatePlanResponseType" NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("planId", "userId", version)
);
ALTER TABLE "CallSession" ADD COLUMN purpose VARCHAR(32) NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "CallSession" ADD COLUMN "introductionPrompt" VARCHAR(255);
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_valid_hello" CHECK (
  (purpose='STANDARD' AND "introductionPrompt" IS NULL) OR
  (purpose='VOICE_INTRODUCTION' AND "callType"='VOICE' AND "introductionPrompt" IS NOT NULL)
);
-- Database-level departure/block closure also covers callers outside the mobile app.
-- History remains available to authorized moderation tooling, never to replacement buddies.
CREATE FUNCTION yariva_close_duo_subjects(party_ids UUID[], reason "ConversationCloseReason") RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE "WingmanPairMatch" SET status='ENDED', "endedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
  WHERE status='ACTIVE' AND ("partyLowId"=ANY(party_ids) OR "partyHighId"=ANY(party_ids));
  UPDATE "Conversation" c SET status=CASE WHEN reason='BLOCKED' THEN 'BLOCKED'::"ConversationStatus" ELSE 'CLOSED_UNMATCHED'::"ConversationStatus" END,
    "closedAt"=CURRENT_TIMESTAMP, "closedReason"=reason, "updatedAt"=CURRENT_TIMESTAMP
  FROM "WingmanPairMatch" m WHERE c."duoMatchId"=m.id AND c.status='ACTIVE'
    AND (m."partyLowId"=ANY(party_ids) OR m."partyHighId"=ANY(party_ids));
  UPDATE "DuoPlan" p SET status='CANCELLED', "updatedAt"=CURRENT_TIMESTAMP
  FROM "Conversation" c JOIN "WingmanPairMatch" m ON m.id=c."duoMatchId"
  WHERE p."conversationId"=c.id AND c.status<>'ACTIVE'
    AND (m."partyLowId"=ANY(party_ids) OR m."partyHighId"=ANY(party_ids))
    AND p.status IN ('PROPOSED','COUNTERED','ACCEPTED');
END; $$;
CREATE FUNCTION yariva_duo_departure() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status='ACTIVE' AND (NEW.status<>'ACTIVE' OR NEW."membershipVersion"<>OLD."membershipVersion") THEN
    PERFORM yariva_close_duo_subjects(ARRAY[OLD.id], 'UNMATCHED');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "WingmanParty_revoke_conversations" AFTER UPDATE OF status, "membershipVersion" ON "WingmanParty"
FOR EACH ROW EXECUTE FUNCTION yariva_duo_departure();
CREATE FUNCTION yariva_duo_block() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE parties UUID[]; party_id UUID;
BEGIN
  IF NEW."deletedAt" IS NULL THEN
    SELECT array_agg(DISTINCT cmatch."partyLowId") || array_agg(DISTINCT cmatch."partyHighId") INTO parties
    FROM "WingmanPairMatch" cmatch JOIN "Conversation" c ON c."duoMatchId"=cmatch.id
    WHERE cmatch.status='ACTIVE' AND EXISTS (SELECT 1 FROM "ConversationMember" a WHERE a."conversationId"=c.id AND a."userId"=NEW."blockerId")
    AND EXISTS (SELECT 1 FROM "ConversationMember" b WHERE b."conversationId"=c.id AND b."userId"=NEW."blockedId");
    FOR party_id IN SELECT DISTINCT x FROM unnest(parties) x ORDER BY x LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(party_id::text, 0));
    END LOOP;
    PERFORM yariva_close_duo_subjects(COALESCE(parties, ARRAY[]::UUID[]), 'BLOCKED');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Block_revoke_duo_conversations" BEFORE INSERT OR UPDATE OF "deletedAt" ON "Block"
FOR EACH ROW EXECUTE FUNCTION yariva_duo_block();

-- Deferred validation permits the conversation and its four snapshots to be
-- inserted together, but never commits an incomplete or foreign membership.
CREATE FUNCTION yariva_check_duo_members() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE cid UUID; expected UUID[]; actual UUID[];
BEGIN
  IF TG_TABLE_NAME='Conversation' THEN cid := NEW.id; ELSE cid := NEW."conversationId"; END IF;
  SELECT array_agg(pm."userId" ORDER BY pm."userId") INTO expected
  FROM "Conversation" c JOIN "WingmanPairMatch" m ON m.id=c."duoMatchId"
  JOIN "WingmanPartyMember" pm ON pm."partyId" IN (m."partyLowId",m."partyHighId")
  WHERE c.id=cid AND pm.status='ACTIVE';
  IF EXISTS (SELECT 1 FROM "Conversation" WHERE id=cid AND "duoMatchId" IS NOT NULL) THEN
    SELECT array_agg("userId" ORDER BY "userId") INTO actual FROM "ConversationMember" WHERE "conversationId"=cid;
    IF cardinality(actual) IS DISTINCT FROM 4 OR actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'Duo conversation requires the four original participants' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "Conversation_four_members" AFTER INSERT ON "Conversation"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION yariva_check_duo_members();
CREATE CONSTRAINT TRIGGER "ConversationMember_four_members" AFTER INSERT ON "ConversationMember"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION yariva_check_duo_members();
CREATE FUNCTION yariva_immutable_conversation_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Conversation subjects and member snapshots are immutable' USING ERRCODE='23514';
END; $$;
CREATE TRIGGER "ConversationMember_immutable" BEFORE UPDATE OR DELETE ON "ConversationMember"
FOR EACH ROW EXECUTE FUNCTION yariva_immutable_conversation_membership();
CREATE TRIGGER "Conversation_subject_immutable" BEFORE UPDATE OF "matchId", "duoMatchId" ON "Conversation"
FOR EACH ROW WHEN (OLD."matchId" IS DISTINCT FROM NEW."matchId" OR OLD."duoMatchId" IS DISTINCT FROM NEW."duoMatchId")
EXECUTE FUNCTION yariva_immutable_conversation_membership();
REVOKE ALL ON FUNCTION yariva_close_duo_subjects(UUID[], "ConversationCloseReason") FROM PUBLIC;

CREATE FUNCTION yariva_duo_member_departure() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status='ACTIVE' AND (TG_OP='DELETE' OR NEW.status<>'ACTIVE'
      OR NEW."userId"<>OLD."userId" OR NEW."partyId"<>OLD."partyId") THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD."partyId"::text, 0));
    UPDATE "WingmanParty" SET "membershipVersion"="membershipVersion"+1,
      status='DISCONNECTED', "disconnectedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
    WHERE id=OLD."partyId" AND status='ACTIVE';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "WingmanPartyMember_revoke_conversations" BEFORE UPDATE OF status, "userId", "partyId" OR DELETE ON "WingmanPartyMember"
FOR EACH ROW EXECUTE FUNCTION yariva_duo_member_departure();
