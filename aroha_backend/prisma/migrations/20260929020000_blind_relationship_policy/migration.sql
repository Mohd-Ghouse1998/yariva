CREATE TABLE "BlindRollout" (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  "exposureTrackingStartedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "BlindRollout" (id) VALUES (1);
CREATE TABLE "MediaExposure" (
  "viewerId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "ownerId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("viewerId","ownerId"), CHECK ("viewerId" <> "ownerId")
);
CREATE TABLE "BlindRelationship" (
  "matchId" uuid PRIMARY KEY REFERENCES "Match"(id) ON DELETE RESTRICT,
  "userLowId" uuid NOT NULL REFERENCES "User"(id),
  "userHighId" uuid NOT NULL REFERENCES "User"(id),
  "occurrenceId" uuid,
  "perParticipantTarget" integer NOT NULL DEFAULT 5 CHECK ("perParticipantTarget" BETWEEN 1 AND 20),
  "initialBlurRadius" integer NOT NULL DEFAULT 20 CHECK ("initialBlurRadius" BETWEEN 1 AND 50),
  "lowCount" integer NOT NULL DEFAULT 0 CHECK ("lowCount" >= 0 AND "lowCount" <= "perParticipantTarget"),
  "highCount" integer NOT NULL DEFAULT 0 CHECK ("highCount" >= 0 AND "highCount" <= "perParticipantTarget"),
  "lowRevealConsent" boolean NOT NULL DEFAULT false,
  "highRevealConsent" boolean NOT NULL DEFAULT false,
  "revealedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("userLowId" < "userHighId")
);
CREATE UNIQUE INDEX "BlindRelationship_userLowId_userHighId_key" ON "BlindRelationship"("userLowId","userHighId");
CREATE TABLE "BlindContribution" (
  "messageId" uuid PRIMARY KEY REFERENCES "Message"(id) ON DELETE RESTRICT,
  "matchId" uuid NOT NULL REFERENCES "BlindRelationship"("matchId"),
  "senderId" uuid NOT NULL REFERENCES "User"(id),
  "contentHash" varchar(64) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BlindContribution_matchId_senderId_contentHash_key" ON "BlindContribution"("matchId","senderId","contentHash");
CREATE INDEX "BlindContribution_matchId_senderId_createdAt_idx" ON "BlindContribution"("matchId","senderId","createdAt");

CREATE FUNCTION public.record_blind_contribution() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE relationship public."BlindRelationship"%ROWTYPE; normalized text; contributed integer;
BEGIN
  IF NEW.type <> 'TEXT' OR NEW.status <> 'ACTIVE' OR NEW."deletedAt" IS NOT NULL THEN RETURN NEW; END IF;
  normalized := lower(regexp_replace(trim(coalesce(NEW."textBody",'')), '[[:space:][:punct:]]+', '', 'g'));
  IF length(normalized) = 0 THEN RETURN NEW; END IF;
  SELECT b.* INTO relationship FROM public."BlindRelationship" b
    JOIN public."Conversation" c ON c."matchId"=b."matchId"
    JOIN public."Match" m ON m.id=b."matchId"
    WHERE c.id=NEW."conversationId" AND c.status='ACTIVE' AND m.status='ACTIVE'
      AND b."revealedAt" IS NULL AND NEW."senderId" IN (b."userLowId", b."userHighId")
    FOR UPDATE OF b;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- A repeated normalized message never counts. At most one eligible text per
  -- participant per ten server seconds; editing/deleting cannot re-award it.
  IF EXISTS (SELECT 1 FROM public."BlindContribution" WHERE "matchId"=relationship."matchId"
    AND "senderId"=NEW."senderId" AND "createdAt">CURRENT_TIMESTAMP - interval '10 seconds') THEN RETURN NEW; END IF;
  INSERT INTO public."BlindContribution" ("messageId","matchId","senderId","contentHash")
    VALUES (NEW.id,relationship."matchId",NEW."senderId",md5(normalized)) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS contributed = ROW_COUNT;
  IF contributed=0 THEN RETURN NEW; END IF;
  UPDATE public."BlindRelationship" SET
    "lowCount"=least("perParticipantTarget","lowCount"+CASE WHEN NEW."senderId"="userLowId" THEN 1 ELSE 0 END),
    "highCount"=least("perParticipantTarget","highCount"+CASE WHEN NEW."senderId"="userHighId" THEN 1 ELSE 0 END)
    WHERE "matchId"=relationship."matchId";
  UPDATE public."BlindRelationship" SET "revealedAt"=CURRENT_TIMESTAMP
    WHERE "matchId"=relationship."matchId" AND "lowCount"="perParticipantTarget" AND "highCount"="perParticipantTarget" AND "revealedAt" IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER record_blind_contribution AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION public.record_blind_contribution();
REVOKE ALL ON FUNCTION public.record_blind_contribution() FROM PUBLIC;
REVOKE ALL ON "BlindContribution", "MediaExposure", "BlindRelationship", "BlindRollout" FROM PUBLIC;

CREATE FUNCTION public.guard_blind_policy() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Blind consent history is retained'; END IF;
 IF TG_OP='INSERT' THEN
   IF NOT EXISTS(SELECT 1 FROM public."Match" m WHERE m.id=NEW."matchId" AND m."userLowId"=NEW."userLowId" AND m."userHighId"=NEW."userHighId") THEN RAISE EXCEPTION 'Blind participants do not match'; END IF;
 ELSE
   IF (NEW."matchId",NEW."userLowId",NEW."userHighId",NEW."perParticipantTarget",NEW."initialBlurRadius") IS DISTINCT FROM (OLD."matchId",OLD."userLowId",OLD."userHighId",OLD."perParticipantTarget",OLD."initialBlurRadius")
      OR NEW."lowCount"<OLD."lowCount" OR NEW."highCount"<OLD."highCount" OR (OLD."revealedAt" IS NOT NULL AND NEW."revealedAt" IS DISTINCT FROM OLD."revealedAt") THEN RAISE EXCEPTION 'Blind policy and progress cannot be reset'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_blind_policy BEFORE INSERT OR UPDATE OR DELETE ON "BlindRelationship" FOR EACH ROW EXECUTE FUNCTION public.guard_blind_policy();
REVOKE ALL ON FUNCTION public.guard_blind_policy() FROM PUBLIC;
