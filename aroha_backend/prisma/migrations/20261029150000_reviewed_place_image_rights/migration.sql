-- Existing planning imagery is preserved; Events only shows catalog photography
-- with a recorded rights attestation. No rights are inferred or backfilled.
ALTER TABLE "ReviewedVenue" ADD COLUMN "photoRights" VARCHAR(500);
