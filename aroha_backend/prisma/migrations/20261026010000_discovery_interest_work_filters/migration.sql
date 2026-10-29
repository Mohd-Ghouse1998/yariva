-- Existing work details remain private; empty filters preserve existing discovery.
ALTER TABLE "UserProfile"
  ADD COLUMN "occupation" VARCHAR(80),
  ADD COLUMN "shareWorkDetails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserDiscoveryPreference"
  ADD COLUMN "interestTagIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "languageFilter" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "occupationFilter" VARCHAR(80),
  ADD COLUMN "smokingFilter" "SmokingHabit"[] NOT NULL DEFAULT ARRAY[]::"SmokingHabit"[],
  ADD COLUMN "drinkingFilter" "DrinkingHabit"[] NOT NULL DEFAULT ARRAY[]::"DrinkingHabit"[],
  ADD COLUMN "exerciseFilter" "ExerciseHabit"[] NOT NULL DEFAULT ARRAY[]::"ExerciseHabit"[];
