import { ProfileCompletionService } from "../../../common/services/profile-completion.service";
import { GetMeService } from "./users.services";

describe("GetMeService", () => {
  it("returns the current user and profile completion status", async () => {
    const service = new GetMeService(
      {
        findMeById: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "user@example.com",
          phone: null,
          role: "USER",
          status: "ACTIVE",
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          isChatFrozen: false,
          isCallFrozen: false,
          lastActiveAt: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-02T00:00:00.000Z"),
          deletedAt: null,
          profile: {
            isHidden: false,
            displayName: "Aroha User",
            bio: "short",
            dateOfBirth: new Date("1994-01-01T00:00:00.000Z"),
            city: "Bengaluru",
            region: "Karnataka",
            countryCode: "IN",
            locationLat: { toString: () => "12.9716" },
            locationLng: { toString: () => "77.5946" },
            locationGeohash: "tdr1v9x6e",
            completedAt: null,
          },
          intents: [{ intent: "FRIENDSHIP" }],
          photos: [],
          discoveryPreference: {
            minAge: 24,
            maxAge: 36,
            maxDistanceKm: 50,
          },
          communicationPreference: {
            id: "comm-1",
          },
        }),
      } as any,
      {
        assertReadable: jest.fn(),
      } as any,
      new ProfileCompletionService(),
    );

    const result = await service.execute("user-1");

    expect(result.user.id).toBe("user-1");
    expect(result.profileCompletion.isComplete).toBe(false);
    expect(result.profileCompletion.missingCriteria).toContain("BIO");
    expect(result.profileCompletion.missingCriteria).toContain("APPROVED_PHOTO");
  });
});
