import { registerAs } from "@nestjs/config";

export default registerAs("planning", () => ({
  venueReviewMaxAgeDays: Number(process.env.VENUE_REVIEW_MAX_AGE_DAYS ?? 30),
  venueSuggestionsEnabled: process.env.VENUE_SUGGESTIONS_ENABLED !== "false",
  venueRadiusMeters: Number(process.env.VENUE_SUGGESTION_RADIUS_METERS ?? 15000),
  maxVenueSuggestions: Number(process.env.VENUE_SUGGESTION_LIMIT ?? 8),
}));
