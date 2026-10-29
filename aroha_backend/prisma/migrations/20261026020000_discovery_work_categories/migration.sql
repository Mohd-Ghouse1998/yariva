-- Categories are explicitly selected by profile owners, never inferred from private titles.
CREATE TYPE "OccupationCategory" AS ENUM ('TECHNOLOGY', 'HEALTHCARE', 'EDUCATION', 'CREATIVE', 'BUSINESS', 'HOSPITALITY', 'STUDENT', 'OTHER');
ALTER TABLE "UserProfile" ADD COLUMN "occupationCategory" "OccupationCategory";
ALTER TABLE "UserDiscoveryPreference" ADD COLUMN "occupationCategoryFilter" "OccupationCategory"[] NOT NULL DEFAULT ARRAY[]::"OccupationCategory"[];
