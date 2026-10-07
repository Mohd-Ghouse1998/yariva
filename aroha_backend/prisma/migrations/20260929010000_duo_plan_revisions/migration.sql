CREATE TABLE "DuoPlanRevision" (
  "requestId" UUID PRIMARY KEY,
  "planId" UUID NOT NULL REFERENCES "DuoPlan"(id) ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  activity VARCHAR(140) NOT NULL,
  "venueName" VARCHAR(200) NOT NULL,
  "publicLocality" VARCHAR(160) NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("planId", version)
);

CREATE FUNCTION yariva_immutable_duo_revision() RETURNS trigger LANGUAGE plpgsql
SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Duo proposal history is immutable' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER duo_revision_immutable BEFORE UPDATE OR DELETE ON "DuoPlanRevision"
FOR EACH ROW EXECUTE FUNCTION yariva_immutable_duo_revision();
