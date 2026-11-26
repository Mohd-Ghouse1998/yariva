ALTER TABLE "UserCommunicationPreference" ADD COLUMN "allowPushSocial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CircleMembership" ADD COLUMN "requestId" UUID;
ALTER TABLE "CircleActivityResponse" ADD COLUMN "requestId" UUID;
