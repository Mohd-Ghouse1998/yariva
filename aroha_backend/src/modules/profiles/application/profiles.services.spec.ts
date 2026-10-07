import { ProfileCompletionService } from "../../../common/services/profile-completion.service";
import {
  GetPublicProfileService,
  ProfileCompletionSyncService,
  UpdateProfileService,
} from "./profiles.services";

const publicAggregate = (
  id: string,
  profileOverrides: Record<string, unknown> = {},
) => ({
  id,
  status: "ACTIVE",
  deletedAt: null,
  isShadowBanned: false,
  isDiscoveryFrozen: false,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z"),
  profile: {
    id: `profile-${id}`,
    userId: id,
    deletedAt: null,
    displayName: id === "viewer" ? "Viewer" : "Target",
    headline: "Looking for something real",
    bio: "A sufficiently complete public profile.",
    dateOfBirth: new Date("1994-01-01T00:00:00.000Z"),
    gender: "WOMAN",
    pronouns: "she/her",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    locationLat: { toString: () => "17.385" },
    locationLng: { toString: () => "78.4867" },
    hideAge: false,
    hideDistance: false,
    isComplete: true,
    isHidden: false,
    isPaused: false,
    isIncognito: false,
    verificationStatus: "VERIFIED",
    preferredRelationshipPace: "INTENTIONAL",
    languages: ["Telugu", "English"],
    foodPreferences: ["Vegetarian"],
    promptResponses: [],
    shareSensitiveCompatibility: false,
    ...profileOverrides,
  },
  photos: [
    {
      id: `photo-${id}`,
      objectKey: `${id}/approved.jpg`,
      bucket: "profiles",
      width: 900,
      height: 1200,
      isPrimary: true,
      position: 0,
      moderationStatus: "APPROVED",
      deletedAt: null,
    },
    {
      id: `pending-${id}`,
      objectKey: `${id}/pending.jpg`,
      bucket: "profiles",
      width: 900,
      height: 1200,
      isPrimary: false,
      position: 1,
      moderationStatus: "PENDING",
      deletedAt: null,
    },
  ],
  intents: [{ intent: "DATING" }],
  interests: [
    {
      interestTagId: "interest-books",
      interestTag: {
        id: "interest-books",
        slug: "books",
        displayName: "Books",
        category: "Culture",
      },
    },
  ],
  lifestyle: null,
  schedulePreference: {
    weekdayMask: 64,
    timeBlockMask: 8,
  },
  discoveryPreference: null,
  communicationPreference: null,
});

describe("GetPublicProfileService", () => {
  const build = (input?: {
    block?: object | null;
    like?: object | null;
    match?: { status: string } | null;
    targetProfile?: Record<string, unknown>;
  }) => {
    const viewer = publicAggregate("viewer");
    const target = publicAggregate("target", input?.targetProfile);
    const prisma = {
      block: { findFirst: jest.fn().mockResolvedValue(input?.block ?? null) },
      like: { findFirst: jest.fn().mockResolvedValue(input?.like ?? null) },
      match: { findUnique: jest.fn().mockResolvedValue(input?.match ?? null) },
    };
    const aggregateRepository = {
      findByUserId: jest.fn(async (id: string) =>
        id === "viewer" ? viewer : id === "target" ? target : null,
      ),
    };
    const service = new GetPublicProfileService(
      prisma as any,
      { getRequiredById: jest.fn().mockResolvedValue({ id: "viewer" }) } as any,
      aggregateRepository as any,
      { assertProfileExists: jest.fn() } as any,
      {
        createPresignedGetObject: jest.fn(async ({ objectKey }) =>
          `https://profiles.test/${objectKey}`,
        ),
      } as any,
    );
    return { service, prisma };
  };

  it("loads a public profile directly without requiring discovery-feed membership", async () => {
    const { service } = build();

    const result = await service.execute({
      viewerId: "viewer",
      targetUserId: "target",
    });

    expect(result.profile.userId).toBe("target");
    expect(result.profile.photos).toHaveLength(1);
    expect(result.profile.photos[0]?.url).toBe(
      "https://profiles.test/target/approved.jpg",
    );
    expect(result.profile.compatibility.sharedInterests).toEqual(["Books"]);
  });

  it("allows an active received-like relationship to view a hidden profile", async () => {
    const { service } = build({
      like: { id: "like-1" },
      targetProfile: { isHidden: true, isPaused: true, isIncognito: true },
    });

    await expect(
      service.execute({ viewerId: "viewer", targetUserId: "target" }),
    ).resolves.toMatchObject({ profile: { userId: "target" } });
  });

  it("rejects access when either person has an active block", async () => {
    const { service } = build({ block: { id: "block-1" } });

    await expect(
      service.execute({ viewerId: "viewer", targetUserId: "target" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("does not disclose a private profile without relationship access", async () => {
    const { service } = build({ targetProfile: { isHidden: true } });

    await expect(
      service.execute({ viewerId: "viewer", targetUserId: "target" }),
    ).rejects.toMatchObject({ code: "PROFILE_NOT_FOUND", status: 404 });
  });
});

describe("ProfileCompletionSyncService", () => {
  it("sets completedAt when a profile transitions to complete", async () => {
    const now = new Date("2026-04-17T10:00:00.000Z");
    const aggregateRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: "user-1",
        status: "ACTIVE",
        deletedAt: null,
        profile: {
          id: "profile-1",
          userId: "user-1",
          displayName: "Aroha User",
          bio: "This is a sufficiently long bio for completion.",
          dateOfBirth: new Date("1995-02-03T00:00:00.000Z"),
          city: "Bengaluru",
          region: "Karnataka",
          countryCode: "IN",
          locationLat: { toString: () => "12.9716" },
          locationLng: { toString: () => "77.5946" },
          locationGeohash: "tdr1v9x6e",
          isHidden: false,
          isComplete: false,
          completedAt: null,
        },
        intents: [{ intent: "FRIENDSHIP" }],
        photos: [
          {
            id: "photo-1",
            isPrimary: true,
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        ],
        discoveryPreference: {
          minAge: 24,
          maxAge: 36,
          maxDistanceKm: 50,
        },
        communicationPreference: {
          id: "comm-1",
        },
      }),
    };
    const userProfileRepository = {
      updateCompletionState: jest.fn().mockResolvedValue(undefined),
    };
    const profileVisibilityPolicyService = {
      assertProfileExists: jest.fn(),
    };
    const service = new ProfileCompletionSyncService(
      aggregateRepository as any,
      userProfileRepository as any,
      profileVisibilityPolicyService as any,
      new ProfileCompletionService(),
    );

    const result = await service.recomputeAndPersist("user-1", {} as any, now);

    expect(userProfileRepository.updateCompletionState).toHaveBeenCalledWith(
      {},
      "user-1",
      {
        isComplete: true,
        completedAt: now,
      },
    );
    expect(result.completion.isComplete).toBe(true);
    expect(result.completion.completedAt).toEqual(now);
  });

  it("preserves previous completedAt when a profile becomes incomplete again", async () => {
    const previousCompletedAt = new Date("2026-04-16T10:00:00.000Z");
    const now = new Date("2026-04-17T10:00:00.000Z");
    const aggregateRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: "user-1",
        status: "ACTIVE",
        deletedAt: null,
        profile: {
          id: "profile-1",
          userId: "user-1",
          displayName: "Aroha User",
          bio: "short",
          dateOfBirth: new Date("1995-02-03T00:00:00.000Z"),
          city: "Bengaluru",
          region: "Karnataka",
          countryCode: "IN",
          locationLat: { toString: () => "12.9716" },
          locationLng: { toString: () => "77.5946" },
          locationGeohash: "tdr1v9x6e",
          isHidden: false,
          isComplete: true,
          completedAt: previousCompletedAt,
        },
        intents: [{ intent: "FRIENDSHIP" }],
        photos: [
          {
            id: "photo-1",
            isPrimary: true,
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        ],
        discoveryPreference: {
          minAge: 24,
          maxAge: 36,
          maxDistanceKm: 50,
        },
        communicationPreference: {
          id: "comm-1",
        },
      }),
    };
    const userProfileRepository = {
      updateCompletionState: jest.fn().mockResolvedValue(undefined),
    };
    const profileVisibilityPolicyService = {
      assertProfileExists: jest.fn(),
    };
    const service = new ProfileCompletionSyncService(
      aggregateRepository as any,
      userProfileRepository as any,
      profileVisibilityPolicyService as any,
      new ProfileCompletionService(),
    );

    const result = await service.recomputeAndPersist("user-1", {} as any, now);

    expect(result.completion.isComplete).toBe(false);
    expect(result.completion.completedAt).toEqual(previousCompletedAt);
  });
});

describe("UpdateProfileService", () => {
  it("updates the profile and returns the recomputed profile payload", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const userProfileRepository = {
      updateProfile: jest.fn().mockResolvedValue(undefined),
    };
    const synced = {
      aggregate: {
        id: "user-1",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
        status: "ACTIVE",
        deletedAt: null,
        profile: {
          id: "profile-1",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-02T00:00:00.000Z"),
          displayName: "Aroha User",
          headline: null,
          bio: "This is a sufficiently long bio for completion.",
          dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
          gender: null,
          pronouns: null,
          city: "Bengaluru",
          region: "Karnataka",
          countryCode: "IN",
          hideAge: false,
          hideDistance: false,
          isHidden: false,
        },
        photos: [],
        intents: [{ intent: "FRIENDSHIP" }],
        interests: [],
        lifestyle: null,
        schedulePreference: null,
        discoveryPreference: {
          minAge: 24,
          maxAge: 36,
          maxDistanceKm: 50,
          intentFilter: [],
          preferredGenders: [],
          includeRecentlyActiveOnly: false,
          preferSameCity: false,
        },
        communicationPreference: {
          allowVoiceCalls: true,
          allowVideoCalls: true,
          allowPushMatches: true,
          allowPushMessages: true,
          allowPushCalls: true,
          allowReadReceipts: true,
        },
      },
      completion: {
        isComplete: false,
        completedAt: null,
        missingCriteria: ["APPROVED_PHOTO", "APPROVED_PRIMARY_PHOTO"],
      },
    };
    const service = new UpdateProfileService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      userProfileRepository as any,
      {
        recomputeAndPersist: jest.fn().mockResolvedValue(synced),
      } as any,
      {
        assertAdult: jest.fn(),
        normalizeLocation: jest.fn().mockReturnValue(undefined),
        normalizeCountryCode: jest.fn().mockReturnValue("IN"),
      } as any,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        buildReadObjectUrl: jest.fn().mockReturnValue("https://example.test/photo.jpg"),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        displayName: "Aroha User",
        city: "Bengaluru",
        region: "Karnataka",
        countryCode: "in",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(userProfileRepository.updateProfile).toHaveBeenCalledWith(
      tx,
      "user-1",
      expect.objectContaining({
        displayName: "Aroha User",
        city: "Bengaluru",
        region: "Karnataka",
        countryCode: "IN",
      }),
    );
    expect(result.profile.userId).toBe("user-1");
    expect(result.profile.completion.missingCriteria).toContain("APPROVED_PHOTO");
  });

  it("rejects invalid dateOfBirth strings before writing profile state", async () => {
    const userProfileRepository = {
      updateProfile: jest.fn(),
    };
    const service = new UpdateProfileService(
      {
        $transaction: jest.fn(),
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      userProfileRepository as any,
      {
        recomputeAndPersist: jest.fn(),
      } as any,
      {
        assertAdult: jest.fn(),
        normalizeLocation: jest.fn().mockReturnValue(undefined),
        normalizeCountryCode: jest.fn().mockReturnValue(undefined),
      } as any,
      {
        touchLastActiveAt: jest.fn(),
      } as any,
      {
        write: jest.fn(),
      } as any,
      {
        buildReadObjectUrl: jest.fn(),
      } as any,
    );

    await expect(
      service.execute({
        userId: "user-1",
        payload: {
          dateOfBirth: "not-a-date",
        },
        metadata: {
          ipAddress: null,
          userAgent: null,
        },
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(userProfileRepository.updateProfile).not.toHaveBeenCalled();
  });
});
