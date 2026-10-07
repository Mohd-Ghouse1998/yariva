import { registerAs } from "@nestjs/config";

export default registerAs("planning", () => ({
  venueSuggestionsEnabled: process.env.VENUE_SUGGESTIONS_ENABLED !== "false",
  venueRadiusMeters: Number(process.env.VENUE_SUGGESTION_RADIUS_METERS ?? 15000),
  maxVenueSuggestions: Number(process.env.VENUE_SUGGESTION_LIMIT ?? 8),
}));
