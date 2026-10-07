-- Scene uploads reuse the hardened photo pipeline without becoming public
-- profile-gallery photos or affecting profile completion/primary selection.
CREATE TYPE "PhotoPurpose" AS ENUM ('PROFILE', 'SCENE');

ALTER TABLE "ProfilePhoto"
  ADD COLUMN "purpose" "PhotoPurpose" NOT NULL DEFAULT 'PROFILE';

CREATE INDEX "ProfilePhoto_userId_purpose_moderationStatus_deletedAt_idx"
  ON "ProfilePhoto"("userId", "purpose", "moderationStatus", "deletedAt");
