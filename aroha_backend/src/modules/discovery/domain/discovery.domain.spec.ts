import {
  CandidateEligibilityService,
  DiscoveryRankingService,
} from "./discovery.domain";

describe("Discovery domain services", () => {
  it("rejects excluded candidates before scoring", () => {
    const service = new CandidateEligibilityService();

    const result = service.isEligible(
      {
        id: "viewer-1",
        discoveryPreference: {
          minAge: 24,
          maxAge: 40,
          maxDistanceKm: 50,
        },
        profile: {
          dateOfBirth: new Date("1992-01-01T00:00:00.000Z"),
          locationLat: { toString: () => "12.9716" },
          locationLng: { toString: () => "77.5946" },
        },
      } as any,
      {
        id: "candidate-1",
        profile: {
          dateOfBirth: new Date("1994-01-01T00:00:00.000Z"),
          locationLat: { toString: () => "12.9800" },
          locationLng: { toString: () => "77.6000" },
          gender: "WOMAN",
        },
        intents: [{ intent: "FRIENDSHIP" }],
      } as any,
      {
        maxDistanceKm: 50,
        selectedIntents: ["FRIENDSHIP"],
        preferredGenders: [],
        excludedUserIds: new Set(["candidate-1"]),
      },
    );

    expect(result.eligible).toBe(false);
  });

  it("scores the same candidate deterministically", () => {
    const service = new DiscoveryRankingService();
    const viewer = {
      interests: [{ interestTagId: "tag-1" }],
      intents: [{ intent: "FRIENDSHIP" }],
      lifestyle: {
        smoking: "NEVER",
        drinking: "SOCIAL",
        exercise: "WEEKLY",
        diet: "OMNIVORE",
        petPreference: "LIKES_PETS",
        sleepPattern: "FLEXIBLE",
        socialEnergy: "BALANCED",
      },
      schedulePreference: {
        weekdayMask: 62,
        timeBlockMask: 240,
        prefersWeekends: true,
        remoteFriendly: false,
      },
      discoveryPreference: {
        intentFilter: ["FRIENDSHIP"],
        maxDistanceKm: 50,
      },
    };
    const candidate = {
      id: "candidate-1",
      interests: [{ interestTagId: "tag-1" }],
      intents: [{ intent: "FRIENDSHIP" }],
      lifestyle: {
        smoking: "NEVER",
        drinking: "SOCIAL",
        exercise: "WEEKLY",
        diet: "OMNIVORE",
        petPreference: "LIKES_PETS",
        sleepPattern: "FLEXIBLE",
        socialEnergy: "BALANCED",
      },
      schedulePreference: {
        weekdayMask: 62,
        timeBlockMask: 240,
        prefersWeekends: true,
        remoteFriendly: false,
      },
      trustScore: {
        score: 82,
      },
      lastActiveAt: new Date("2026-04-17T08:00:00.000Z"),
      profile: {
        city: "Bengaluru",
        region: "Karnataka",
        countryCode: "IN",
      },
    };

    const first = service.scoreCandidate(viewer as any, candidate as any, {
      distanceKm: 8,
      primaryIntentBucket: "FRIENDSHIP",
      recentlyServed: false,
    });
    const second = service.scoreCandidate(viewer as any, candidate as any, {
      distanceKm: 8,
      primaryIntentBucket: "FRIENDSHIP",
      recentlyServed: false,
    });

    expect(first.totalScore).toBe(second.totalScore);
    expect(first.distanceKm).toBe(second.distanceKm);
    expect(first.cityBucket).toBe(second.cityBucket);
  });
});
