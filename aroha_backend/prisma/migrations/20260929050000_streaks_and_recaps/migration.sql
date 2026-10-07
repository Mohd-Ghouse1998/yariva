CREATE TABLE "ActivityRollout" (id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), "startedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "ActivityRollout"(id) VALUES(1);
CREATE TABLE "UserStreak" (
 "userId" uuid PRIMARY KEY REFERENCES "User"(id), "currentStreak" integer NOT NULL DEFAULT 0 CHECK("currentStreak">=0),
 "longestStreak" integer NOT NULL DEFAULT 0 CHECK("longestStreak">="currentStreak"), "balance" integer NOT NULL DEFAULT 0 CHECK(balance>=0),
 "lastActivityDate" date, "displayEnabled" boolean NOT NULL DEFAULT true, "recapNotificationsEnabled" boolean NOT NULL DEFAULT false
);
CREATE TABLE "QualifyingActivity" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "User"(id),
 "sceneId" uuid NOT NULL UNIQUE REFERENCES "Scene"(id), "occurredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "activityDate" date NOT NULL, "transactionId" bigint NOT NULL DEFAULT txid_current()
);
CREATE INDEX "QualifyingActivity_userId_occurredAt_idx" ON "QualifyingActivity"("userId","occurredAt");
CREATE TABLE "VibePointsLedger" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "User"(id),
 "activityId" uuid NOT NULL UNIQUE REFERENCES "QualifyingActivity"(id), "activityDate" date NOT NULL,
 amount integer NOT NULL CHECK(amount IN(10,20,30,40,50)), streak integer NOT NULL CHECK(streak>0),
 "awardedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("userId","activityDate")
);
CREATE INDEX "VibePointsLedger_userId_awardedAt_idx" ON "VibePointsLedger"("userId","awardedAt");
CREATE TABLE "StreakIntegrityAnomaly" ("activityId" uuid PRIMARY KEY REFERENCES "QualifyingActivity"(id), "userId" uuid NOT NULL REFERENCES "User"(id), "detectedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "AcceptedPlanFact" ("planId" uuid NOT NULL, kind varchar(8) NOT NULL CHECK(kind IN('SOLO','DUO')), "userIds" uuid[] NOT NULL, "acceptedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(kind,"planId"));
CREATE INDEX "AcceptedPlanFact_acceptedAt_idx" ON "AcceptedPlanFact"("acceptedAt");
CREATE TABLE "WeeklyRecap" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "User"(id), "periodStart" timestamp(3) NOT NULL,
 "periodEnd" timestamp(3) NOT NULL, version integer NOT NULL DEFAULT 1, "scenesPublished" integer NOT NULL CHECK("scenesPublished">=0),
 "plansAccepted" integer NOT NULL CHECK("plansAccepted">=0), "activityDays" integer NOT NULL CHECK("activityDays">=0),
 "pointsEarned" integer NOT NULL CHECK("pointsEarned">=0), "generatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "historyStartedAt" timestamp(3) NOT NULL, UNIQUE("userId","periodStart",version), CHECK("periodEnd">"periodStart")
);
CREATE INDEX "WeeklyRecap_periodEnd_userId_idx" ON "WeeklyRecap"("periodEnd","userId");

CREATE FUNCTION public.prepare_qualifying_activity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE captured timestamptz := clock_timestamp();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."Scene" s JOIN public."User" u ON u.id=s."ownerId" WHERE s.id=NEW."sceneId" AND s."ownerId"=NEW."userId" AND s.status='ACTIVE' AND s."expiresAt">captured AT TIME ZONE 'UTC' AND u.status='ACTIVE' AND u."deletedAt" IS NULL) THEN RAISE EXCEPTION 'Activity needs an owned, valid Scene publication'; END IF;
 NEW."occurredAt" := captured AT TIME ZONE 'UTC'; NEW."activityDate" := (captured AT TIME ZONE 'Asia/Kolkata')::date; NEW."transactionId" := txid_current();
 RETURN NEW;
END $$;
CREATE TRIGGER prepare_qualifying_activity BEFORE INSERT ON "QualifyingActivity" FOR EACH ROW EXECUTE FUNCTION public.prepare_qualifying_activity();

CREATE FUNCTION public.increment_user_streak(target_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE activity public."QualifyingActivity"%ROWTYPE; summary public."UserStreak"%ROWTYPE; reward integer:=0; next_streak integer; anomaly boolean:=false; inserted integer;
BEGIN
 IF pg_trigger_depth()=0 THEN RAISE EXCEPTION 'Only trusted activity triggers award points'; END IF;
 SELECT * INTO STRICT activity FROM public."QualifyingActivity" WHERE id=nullif(current_setting('yariva.qualifying_activity_id',true),'')::uuid AND "userId"=target_user_id AND "transactionId"=txid_current();
 INSERT INTO public."UserStreak"("userId") VALUES(target_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT summary FROM public."UserStreak" WHERE "userId"=target_user_id FOR UPDATE;
 IF summary."lastActivityDate">activity."activityDate" THEN
   anomaly:=true; INSERT INTO public."StreakIntegrityAnomaly"("activityId","userId") VALUES(activity.id,target_user_id) ON CONFLICT DO NOTHING;
 ELSIF summary."lastActivityDate" IS DISTINCT FROM activity."activityDate" THEN
   next_streak:=CASE WHEN summary."lastActivityDate"=activity."activityDate"-1 THEN summary."currentStreak"+1 ELSE 1 END;
   reward:=least(10*next_streak,50);
   INSERT INTO public."VibePointsLedger"("userId","activityId","activityDate",amount,streak,"awardedAt") VALUES(target_user_id,activity.id,activity."activityDate",reward,next_streak,activity."occurredAt") ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT;
   IF inserted=1 THEN
     UPDATE public."UserStreak" SET "currentStreak"=next_streak,"longestStreak"=greatest("longestStreak",next_streak),balance=balance+reward,"lastActivityDate"=activity."activityDate" WHERE "userId"=target_user_id RETURNING * INTO summary;
   ELSE reward:=0; END IF;
 END IF;
 RETURN jsonb_build_object('currentStreak',summary."currentStreak",'longestStreak',summary."longestStreak",'balance',summary.balance,'lastActivityDate',summary."lastActivityDate",'awardedAmount',reward,'integrityAnomaly',anomaly);
END $$;
CREATE FUNCTION public.award_qualifying_activity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM set_config('yariva.qualifying_activity_id',NEW.id::text,true); PERFORM public.increment_user_streak(NEW."userId"); RETURN NEW; END $$;
CREATE TRIGGER award_qualifying_activity AFTER INSERT ON "QualifyingActivity" FOR EACH ROW EXECUTE FUNCTION public.award_qualifying_activity();

CREATE FUNCTION public.record_plan_acceptance() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE participants uuid[];
BEGIN
 IF NEW.status::text<>'ACCEPTED' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='DatePlan' THEN
   SELECT ARRAY[m."userLowId",m."userHighId"] INTO participants FROM public."Match" m WHERE m.id=NEW."matchId";
   INSERT INTO public."AcceptedPlanFact"("planId",kind,"userIds") VALUES(NEW.id,'SOLO',participants) ON CONFLICT DO NOTHING;
 ELSE
   SELECT array_agg(m."userId" ORDER BY m."userId") INTO participants FROM public."ConversationMember" m WHERE m."conversationId"=NEW."conversationId";
   IF cardinality(participants)<>4 THEN RAISE EXCEPTION 'Accepted group plan needs four participants'; END IF;
   INSERT INTO public."AcceptedPlanFact"("planId",kind,"userIds") VALUES(NEW.id,'DUO',participants) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_solo_plan_acceptance AFTER INSERT OR UPDATE OF status ON "DatePlan" FOR EACH ROW EXECUTE FUNCTION public.record_plan_acceptance();
CREATE TRIGGER record_duo_plan_acceptance AFTER INSERT OR UPDATE OF status ON "DuoPlan" FOR EACH ROW EXECUTE FUNCTION public.record_plan_acceptance();

CREATE FUNCTION public.retain_activity_history() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Activity and reward history is immutable'; END $$;
CREATE TRIGGER retain_qualifying_activity BEFORE UPDATE OR DELETE ON "QualifyingActivity" FOR EACH ROW EXECUTE FUNCTION public.retain_activity_history();
CREATE TRIGGER retain_vibe_points BEFORE UPDATE OR DELETE ON "VibePointsLedger" FOR EACH ROW EXECUTE FUNCTION public.retain_activity_history();
CREATE TRIGGER retain_plan_acceptance BEFORE UPDATE OR DELETE ON "AcceptedPlanFact" FOR EACH ROW EXECUTE FUNCTION public.retain_activity_history();
REVOKE ALL ON "ActivityRollout","UserStreak","QualifyingActivity","VibePointsLedger","StreakIntegrityAnomaly","AcceptedPlanFact","WeeklyRecap" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_qualifying_activity(),public.increment_user_streak(uuid),public.award_qualifying_activity(),public.record_plan_acceptance(),public.retain_activity_history() FROM PUBLIC;
