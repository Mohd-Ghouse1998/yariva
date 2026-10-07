import { ProfileCompletionService } from "../../../common/services/profile-completion.service";
import {
  UpdateUserInterestsService,
  UpdateUserIntentsService,
} from "./interests.services";
import {
  IntentCompatibilityService,
  InterestValidationService,
} from "../domain/interests.domain";

describe("Interests services", () => {
  it("replaces user interests transactionally", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const userInterestRepository = {
      listAllByUser: jest.fn().mockResolvedValue([
        {
          id: "row-1",
          interestTagId: "tag-1",
          deletedAt: null,
        },
        {
          id: "row-2",
          interestTagId: "tag-2",
          deletedAt: new Date("2026-04-10T00:00:00.000Z"),
        },
      ]),
      softDelete: jest.fn().mockResolvedValue(undefined),
      reactivate: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
      listActiveByUser: jest.fn().mockResolvedValue([
        {
          id: "row-2",
          interestTag: {
            id: "tag-2",
            slug: "music",
            displayName: "Music",
            category: "arts",
          },
        },
        {
          id: "row-3",
          interestTag: {
            id: "tag-3",
            slug: "hiking",
            displayName: "Hiking",
            category: "outdoors",
          },
        },
      ]),
    };
    const service = new UpdateUserInterestsService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      new InterestValidationService(),
      {
        findActiveByIds: jest.fn().mockResolvedValue([
          {
            id: "tag-2",
            isActive: true,
          },
          {
            id: "tag-3",
            isActive: true,
          },
        ]),
      } as any,
      userInterestRepository as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        interestTagIds: ["tag-2", "tag-3"],
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(userInterestRepository.softDelete).toHaveBeenCalled();
    expect(userInterestRepository.reactivate).toHaveBeenCalledWith(tx, "row-2");
    expect(userInterestRepository.create).toHaveBeenCalledWith(
      tx,
      "user-1",
      "tag-3",
    );
    expect(result.interests).toHaveLength(2);
  });

  it("updates intents and recomputes profile completion", async () => {
    const tx = {};
    const prisma = {
      $transaction: jest.fn(async (callback: (client: object) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const updateCompletionState = jest.fn().mockResolvedValue(undefined);
    const service = new UpdateUserIntentsService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      new IntentCompatibilityService(),
      {
        listAllByUser: jest.fn().mockResolvedValue([
          {
            id: "intent-row-1",
            intent: "FRIENDSHIP",
            deletedAt: null,
          },
        ]),
        softDelete: jest.fn().mockResolvedValue(undefined),
        reactivate: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        findByUserId: jest.fn().mockResolvedValue({
          id: "user-1",
          status: "ACTIVE",
          deletedAt: null,
          profile: {
            id: "profile-1",
            isHidden: false,
            displayName: "Aroha User",
            bio: "This is a sufficiently long bio for completion.",
            dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
            city: "Bengaluru",
            region: "Karnataka",
            countryCode: "IN",
            locationLat: { toString: () => "12.9716" },
            locationLng: { toString: () => "77.5946" },
            locationGeohash: "tdr1v9x6e",
            isComplete: false,
            completedAt: null,
          },
          intents: [{ intent: "RELATIONSHIP" }],
          photos: [
            {
              id: "photo-1",
              isPrimary: true,
              moderationStatus: "APPROVED",
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
        updateCompletionState,
      } as any,
      new ProfileCompletionService(),
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        intents: ["RELATIONSHIP"],
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(updateCompletionState).toHaveBeenCalled();
    expect(result.intents).toEqual(["RELATIONSHIP"]);
    expect(result.profileCompletion.isComplete).toBe(true);
  });
});
