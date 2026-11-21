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

describe("Discovery people filters", () => {
  const service = new CandidateEligibilityService();
  const viewer = {
    id: "viewer",
    profile: {
      dateOfBirth: new Date("1994-01-01"),
      locationLat: 17.4,
      locationLng: 78.4,
      gender: "MAN",
    },
  };
  const candidate = {
    id: "candidate",
    profile: {
      dateOfBirth: new Date("1994-01-01"),
      locationLat: 17.4,
      locationLng: 78.4,
      gender: "WOMAN",
      languages: ["English", "Telugu"],
      occupation: "Software Engineer",
      occupationCategory: "TECHNOLOGY",
      shareWorkDetails: true,
    },
    interests: [{ interestTagId: "coffee" }],
    intents: [{ intent: "FRIENDSHIP" }],
    lifestyle: { smoking: "NEVER", drinking: "SOCIAL", exercise: "WEEKLY" },
    lastActiveAt: new Date(),
  };
  const eligible = (
    filters: Record<string, unknown>,
    person: unknown = candidate,
  ) =>
    service.isEligible(
      { ...viewer, discoveryPreference: filters } as any,
      person as any,
      {
        maxDistanceKm: 15,
        selectedIntents: ["FRIENDSHIP"],
        preferredGenders: [],
        excludedUserIds: new Set(),
      },
    ).eligible;

  it("requires mutual dating preferences while preserving shared friendship", () => {
    const person = {
      ...candidate,
      profile: { ...candidate.profile, gender: "TRANS_WOMAN" },
      intents: [{ intent: "DATING" }, { intent: "FRIENDSHIP" }],
    };
    const browse = (selectedIntents: string[], preferredGenders: string[], reciprocal: string[]) =>
      service.isEligible(
        { ...viewer, profile: { ...viewer.profile, gender: "NON_BINARY" } } as any,
        { ...person, discoveryPreference: { preferredGenders: reciprocal } } as any,
        { maxDistanceKm: 15, selectedIntents, preferredGenders, excludedUserIds: new Set() },
      );

    expect(browse(["DATING"], ["TRANS_WOMAN"], ["NON_BINARY"]).eligible).toBe(true);
    expect(browse(["DATING"], ["WOMAN"], ["NON_BINARY"]).eligible).toBe(false);
    expect(browse(["DATING"], ["TRANS_WOMAN"], ["MAN"]).eligible).toBe(false);
    expect(browse(["DATING", "FRIENDSHIP"], ["WOMAN"], ["MAN"]))
      .toMatchObject({ eligible: true, primaryIntentBucket: "FRIENDSHIP" });
  });

  it("preserves discovery when optional filters are empty", () => {
    expect(eligible({})).toBe(true);
    expect(
      eligible({
        interestTagIds: [],
        languageFilter: [],
        occupationFilter: null,
      }),
    ).toBe(true);
  });

  it("matches any selection within a category but requires every selected category", () => {
    expect(
      eligible({
        interestTagIds: ["music", "coffee"],
        languageFilter: [" telugu ", "Hindi"],
        occupationFilter: "ENGINEER",
        smokingFilter: ["NEVER"],
        drinkingFilter: ["SOCIAL"],
        exerciseFilter: ["WEEKLY"],
      }),
    ).toBe(true);
    expect(
      eligible({ interestTagIds: ["music"], languageFilter: ["English"] }),
    ).toBe(false);
    expect(
      eligible({ interestTagIds: ["coffee"], languageFilter: ["Hindi"] }),
    ).toBe(false);
    expect(eligible({ exerciseFilter: ["DAILY"] })).toBe(false);
  });

  it("cannot infer private work details through search", () => {
    const privateCandidate = {
      ...candidate,
      profile: { ...candidate.profile, shareWorkDetails: false },
    };
    expect(eligible({ occupationFilter: "Engineer" }, privateCandidate)).toBe(
      false,
    );
    expect(eligible({}, privateCandidate)).toBe(true);
    expect(
      eligible(
        { occupationFilter: "Engineer" },
        { ...candidate, profile: { ...candidate.profile, occupation: null } },
      ),
    ).toBe(false);
  });

  it("uses explicit work categories with OR within and AND across filters", () => {
    expect(eligible({ occupationCategoryFilter: ["HEALTHCARE", "TECHNOLOGY"] })).toBe(true);
    expect(eligible({ occupationCategoryFilter: ["HEALTHCARE"] })).toBe(false);
    expect(eligible({ occupationCategoryFilter: ["TECHNOLOGY"], interestTagIds: ["music"] })).toBe(false);
    expect(eligible({ occupationCategoryFilter: ["TECHNOLOGY"], occupationFilter: "doctor" })).toBe(false);
    const missing = { ...candidate, profile: { ...candidate.profile, occupationCategory: null } };
    expect(eligible({ occupationCategoryFilter: ["TECHNOLOGY"] }, missing)).toBe(false);
    expect(eligible({ occupationCategoryFilter: [] }, missing)).toBe(true);
    expect(eligible({ occupationCategoryFilter: ["TECHNOLOGY"] }, {
      ...candidate, profile: { ...candidate.profile, shareWorkDetails: false },
    })).toBe(false);
  });

  it("does not treat missing lifestyle or activity as a match", () => {
    expect(
      eligible({ smokingFilter: ["NEVER"] }, { ...candidate, lifestyle: null }),
    ).toBe(false);
    expect(
      eligible(
        { includeRecentlyActiveOnly: true },
        { ...candidate, lastActiveAt: null },
      ),
    ).toBe(false);
    expect(
      eligible(
        { includeRecentlyActiveOnly: true },
        { ...candidate, lastActiveAt: new Date(Date.now() - 8 * 86400000) },
      ),
    ).toBe(false);
    expect(eligible({ includeRecentlyActiveOnly: true })).toBe(true);
  });
});
