CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "SceneIntent" AS ENUM ('DATING', 'FRIENDSHIP', 'CASUAL_HANG');
CREATE TYPE "SceneStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED', 'REPLACED');
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'INVALID');

ALTER TABLE "UserProfile"
  ADD COLUMN "locationPoint" geography(Point, 4326);

UPDATE "UserProfile"
SET "locationPoint" = ST_SetSRID(
      ST_MakePoint("locationLng"::double precision, "locationLat"::double precision),
      4326
    )::geography,
    "locationUpdatedAt" = COALESCE("locationUpdatedAt", "updatedAt")
WHERE "locationLat" BETWEEN -90 AND 90
  AND "locationLng" BETWEEN -180 AND 180;

CREATE OR REPLACE FUNCTION sync_user_profile_location_point()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW."locationLat" BETWEEN -90 AND 90
     AND NEW."locationLng" BETWEEN -180 AND 180 THEN
    NEW."locationPoint" := ST_SetSRID(
      ST_MakePoint(NEW."locationLng"::double precision, NEW."locationLat"::double precision),
      4326
    )::geography;
  ELSE
    NEW."locationPoint" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "UserProfile_sync_location_point"
BEFORE INSERT OR UPDATE OF "locationLat", "locationLng" ON "UserProfile"
FOR EACH ROW EXECUTE FUNCTION sync_user_profile_location_point();

CREATE INDEX "UserProfile_locationPoint_gist_idx"
  ON "UserProfile" USING GIST ("locationPoint");

CREATE TABLE "Scene" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "lineageId" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "intent" "SceneIntent" NOT NULL,
  "activity" VARCHAR(120) NOT NULL,
  "canonicalActivity" VARCHAR(80) NOT NULL,
  "activityTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "availableFrom" TIMESTAMP(3),
  "availableUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "SceneStatus" NOT NULL DEFAULT 'ACTIVE',
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scene_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Scene_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Scene_window_order_check" CHECK ("availableFrom" IS NULL OR "availableUntil" IS NULL OR "availableFrom" < "availableUntil"),
  CONSTRAINT "Scene_window_within_lifetime_check" CHECK (("availableFrom" IS NULL OR "availableFrom" < "expiresAt") AND ("availableUntil" IS NULL OR "availableUntil" <= "expiresAt")),
  CONSTRAINT "Scene_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "Scene_lineageId_version_key" ON "Scene"("lineageId", "version");
CREATE UNIQUE INDEX "Scene_one_active_per_owner_key" ON "Scene"("ownerId") WHERE "status" = 'ACTIVE';
CREATE INDEX "Scene_ownerId_status_expiresAt_idx" ON "Scene"("ownerId", "status", "expiresAt");
CREATE INDEX "Scene_intent_canonicalActivity_status_expiresAt_idx" ON "Scene"("intent", "canonicalActivity", "status", "expiresAt");
CREATE INDEX "Scene_activityTokens_gin_idx" ON "Scene" USING GIN ("activityTokens");
CREATE INDEX "Scene_expiresAt_status_idx" ON "Scene"("expiresAt", "status");

INSERT INTO "FeatureFlag" (
  "id", "key", "description", "scope", "enabled", "config", "allowlistUserIds", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'scenes.v1',
  'Enable Scene publishing and intent-based Scene discovery',
  'GLOBAL',
  false,
  '{"radiusMeters":15000,"lifetimeHours":12}'::jsonb,
  '[]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("key") DO NOTHING;

CREATE TABLE "PushDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL,
  "pushTokenId" UUID NOT NULL,
  "provider" "PushProvider" NOT NULL,
  "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" VARCHAR(255),
  "lastErrorCode" VARCHAR(120),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PushDelivery_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PushDelivery_notificationId_pushTokenId_key" ON "PushDelivery"("notificationId", "pushTokenId");
CREATE INDEX "PushDelivery_status_updatedAt_idx" ON "PushDelivery"("status", "updatedAt");
