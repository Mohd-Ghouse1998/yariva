-- Scene visuals may only reference an existing moderated profile photo.
-- Ownership and APPROVED/non-deleted state are enforced by the Scene service;
-- the FK prevents dangling references if a hard delete is ever performed.
ALTER TABLE "Scene" ADD COLUMN "photoId" UUID;

ALTER TABLE "Scene"
  ADD CONSTRAINT "Scene_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "ProfilePhoto"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Scene_photoId_idx" ON "Scene"("photoId");
