ALTER TABLE "ReviewedVenue"
  ADD COLUMN "rating" DECIMAL(2,1),
  ADD COLUMN "ratingCount" INTEGER,
  ADD COLUMN "ratingSource" VARCHAR(120);

CREATE INDEX "ReviewedVenue_rating_ratingCount_idx"
  ON "ReviewedVenue"("rating", "ratingCount");

ALTER TABLE "ReviewedVenue"
  ADD CONSTRAINT "ReviewedVenue_rating_check"
    CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5)),
  ADD CONSTRAINT "ReviewedVenue_ratingCount_check"
    CHECK ("ratingCount" IS NULL OR "ratingCount" >= 0);
