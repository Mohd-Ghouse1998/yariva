import { ProfileCompletionService } from "./profile-completion.service";

describe("ProfileCompletionService", () => {
  it("marks bio as missing when it exceeds the Phase 1.5 maximum length", () => {
    const service = new ProfileCompletionService();

    const result = service.evaluate({
      accountIsActive: true,
      profileHidden: false,
      displayName: "Aroha User",
      bio: "x".repeat(1001),
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      city: "Bengaluru",
      region: "Karnataka",
      countryCode: "IN",
      locationLat: "12.9716",
      locationLng: "77.5946",
      locationGeohash: "tdr1v9x6e",
      activeIntentCount: 1,
      approvedPhotoCount: 1,
      approvedPrimaryPhotoCount: 1,
      discoveryPreference: {
        minAge: 24,
        maxAge: 36,
        maxDistanceKm: 50,
      },
      communicationPreferenceExists: true,
      completedAt: null,
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingCriteria).toContain("BIO");
  });
});
