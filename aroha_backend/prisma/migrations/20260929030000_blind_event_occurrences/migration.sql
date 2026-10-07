CREATE TABLE "BlindEventOccurrence" (
 id uuid PRIMARY KEY,
 "occurrenceKey" varchar(100) NOT NULL UNIQUE,
 "startsAt" timestamp(3) NOT NULL,
 "endsAt" timestamp(3) NOT NULL,
 city varchar(120) NOT NULL DEFAULT 'Hyderabad',
 state varchar(16) NOT NULL DEFAULT 'UPCOMING' CHECK (state IN ('UPCOMING','LIVE','ENDED','CANCELLED')),
 "cancelledAt" timestamp(3),
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("endsAt">"startsAt")
);
CREATE INDEX "BlindEventOccurrence_startsAt_endsAt_idx" ON "BlindEventOccurrence"("startsAt","endsAt");
CREATE TABLE "BlindEventEnrollment" (
 "occurrenceId" uuid NOT NULL REFERENCES "BlindEventOccurrence"(id),
 "userId" uuid NOT NULL REFERENCES "User"(id),
 intent varchar(16) NOT NULL CHECK (intent IN ('DATING','FRIENDSHIP')),
 "notificationsEnabled" boolean NOT NULL DEFAULT false,
 "joinedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leftAt" timestamp(3),
 PRIMARY KEY ("occurrenceId","userId")
);
CREATE INDEX "BlindEventEnrollment_userId_joinedAt_idx" ON "BlindEventEnrollment"("userId","joinedAt");
CREATE TABLE "BlindEventInterest" (
 "occurrenceId" uuid NOT NULL REFERENCES "BlindEventOccurrence"(id),
 "actorId" uuid NOT NULL REFERENCES "User"(id),
 "targetId" uuid NOT NULL REFERENCES "User"(id),
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("occurrenceId","actorId","targetId"), CHECK ("actorId"<>"targetId")
);
ALTER TABLE "BlindRelationship" ADD CONSTRAINT "BlindRelationship_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "BlindEventOccurrence"(id);
INSERT INTO "FeatureFlag" (id,key,description,enabled,"updatedAt")
 VALUES(gen_random_uuid(),'blind.v1','Optional consent-based Thursday pilot',false,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING;
REVOKE ALL ON "BlindEventOccurrence","BlindEventEnrollment","BlindEventInterest" FROM PUBLIC;
