ALTER TYPE "ReportTargetType" ADD VALUE 'PRIVATE_STORY';

ALTER TABLE "Report" ADD COLUMN "targetPrivateStoryId" UUID;
CREATE INDEX "Report_targetPrivateStoryId_idx" ON "Report"("targetPrivateStoryId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetPrivateStoryId_fkey"
  FOREIGN KEY ("targetPrivateStoryId") REFERENCES "PrivateStory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
