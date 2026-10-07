ALTER TABLE "PrivateStory" DROP CONSTRAINT "PrivateStory_text_check";
ALTER TABLE "PrivateStory" ADD CONSTRAINT "PrivateStory_text_check"
  CHECK (length(trim("text")) > 0 OR "mediaObjectKey" IS NOT NULL);
