import { CreateLikeService } from "./likes.services";
import { LikePolicyService } from "../domain/likes.domain";
import { MATCH_EVENTS } from "../../matches/events/matches.events";

describe("CreateLikeService", () => {
  it("creates a match transactionally when a reciprocal active like exists", async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
      match: {
        findUnique: jest.fn().mockResolvedValue({
          id: "match-1",
        }),
      },
    };
    const actorLike = {
      id: "like-1",
      actorId: "user-1",
      targetId: "user-2",
      introNote: "Your Sunday bookshop ritual sounds lovely.",
      status: "ACTIVE" as const,
      matchedAt: null,
      retractedAt: null,
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    };
    const matchedLike = {
      ...actorLike,
      status: "MATCHED" as const,
      matchedAt: new Date("2026-04-17T10:01:00.000Z"),
    };
    const reciprocalLike = {
      id: "like-2",
      actorId: "user-2",
      targetId: "user-1",
      status: "ACTIVE" as const,
      matchedAt: null,
      retractedAt: null,
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    };
    const likeRepository = {
      findByActorAndTarget: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(reciprocalLike),
      create: jest.fn().mockResolvedValue(actorLike),
      reactivate: jest.fn(),
      markMatched: jest
        .fn()
        .mockResolvedValueOnce(matchedLike)
        .mockResolvedValueOnce({
          ...reciprocalLike,
          status: "MATCHED" as const,
          matchedAt: new Date("2026-04-17T10:01:00.000Z"),
        }),
    };
    const matchReaderService = {
      getRequiredMatch: jest.fn().mockResolvedValue({
        id: "match-1",
      }),
      mapSummary: jest.fn().mockReturnValue({
        id: "match-1",
        status: "ACTIVE",
      }),
    };
    const conversationReaderService = {
      getRequiredConversation: jest.fn().mockResolvedValue({
        id: "conversation-1",
      }),
      mapConversationSummary: jest.fn().mockReturnValue({
        id: "conversation-1",
        matchId: "match-1",
        status: "ACTIVE",
      }),
    };
    const domainEventPublisher = {
      publishSafely: jest.fn().mockResolvedValue(true),
    };
    const bullmqProducer = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CreateLikeService(
      prisma as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as any,
      new LikePolicyService(),
      likeRepository as any,
      {
        findLikeTarget: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
        hasHistoricalMatchBetween: jest.fn().mockResolvedValue(false),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
      } as any,
      {
        execute: jest.fn().mockResolvedValue({
          match: {
            id: "match-1",
          },
          conversationId: "conversation-1",
          created: true,
        }),
      } as any,
      matchReaderService as any,
      conversationReaderService as any,
      {
        mapLike: jest.fn().mockReturnValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      domainEventPublisher as any,
      bullmqProducer as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        error: jest.fn(),
      } as any,
      {} as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        targetUserId: "user-2",
        introNote: "  Your Sunday bookshop ritual sounds lovely.  ",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.outcome).toBe("MATCH_CREATED");
    expect(likeRepository.create).toHaveBeenCalledWith(tx, {
      actorId: "user-1",
      targetId: "user-2",
      introNote: "Your Sunday bookshop ritual sounds lovely.",
    });
    expect(domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      MATCH_EVENTS.CREATED,
      expect.objectContaining({
        matchId: "match-1",
      }),
    );
  });

  it("returns the existing match idempotently when the like is already matched", async () => {
    const service = new CreateLikeService(
      {
        $transaction: jest.fn(),
        match: {
          findUnique: jest.fn().mockResolvedValue({
            id: "match-1",
          }),
        },
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      {
        touchLastActiveAt: jest.fn(),
      } as any,
      new LikePolicyService(),
      {
        findByActorAndTarget: jest.fn().mockResolvedValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
          matchedAt: new Date("2026-04-17T10:01:00.000Z"),
          retractedAt: null,
          createdAt: new Date("2026-04-17T10:00:00.000Z"),
          updatedAt: new Date("2026-04-17T10:01:00.000Z"),
        }),
      } as any,
      {
        findLikeTarget: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
        hasHistoricalMatchBetween: jest.fn().mockResolvedValue(false),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
      } as any,
      {
        execute: jest.fn(),
      } as any,
      {
        getRequiredMatch: jest.fn().mockResolvedValue({
          id: "match-1",
        }),
        mapSummary: jest.fn().mockReturnValue({
          id: "match-1",
          status: "ACTIVE",
        }),
      } as any,
      {
        getRequiredConversation: jest.fn().mockResolvedValue({
          id: "conversation-1",
        }),
        mapConversationSummary: jest.fn().mockReturnValue({
          id: "conversation-1",
          matchId: "match-1",
          status: "ACTIVE",
        }),
      } as any,
      {
        mapLike: jest.fn().mockReturnValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as any,
      {
        enqueue: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        error: jest.fn(),
      } as any,
      {} as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        targetUserId: "user-2",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.outcome).toBe("MATCH_CREATED");
  });
});

describe("CreateLikeService post-commit safety", () => {
  it("still returns MATCH_CREATED when notification enqueue fails after commit", async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
      },
    };
    const logger = {
      error: jest.fn(),
    };
    const service = new CreateLikeService(
      {
        $transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        ),
        match: {
          findUnique: jest.fn().mockResolvedValue({ id: "match-1" }),
        },
      } as any,
      {
        getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
      } as any,
      {
        touchLastActiveAt: jest.fn().mockResolvedValue(undefined),
      } as any,
      new LikePolicyService(),
      {
        findByActorAndTarget: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "like-2",
            actorId: "user-2",
            targetId: "user-1",
            status: "ACTIVE",
            matchedAt: null,
            retractedAt: null,
            createdAt: new Date("2026-04-17T10:00:00.000Z"),
            updatedAt: new Date("2026-04-17T10:00:00.000Z"),
          }),
        create: jest.fn().mockResolvedValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "ACTIVE",
          matchedAt: null,
          retractedAt: null,
          createdAt: new Date("2026-04-17T10:00:00.000Z"),
          updatedAt: new Date("2026-04-17T10:00:00.000Z"),
        }),
        reactivate: jest.fn(),
        markMatched: jest
          .fn()
          .mockResolvedValueOnce({
            id: "like-1",
            actorId: "user-1",
            targetId: "user-2",
            status: "MATCHED",
            matchedAt: new Date("2026-04-17T10:01:00.000Z"),
            retractedAt: null,
            createdAt: new Date("2026-04-17T10:00:00.000Z"),
            updatedAt: new Date("2026-04-17T10:01:00.000Z"),
          })
          .mockResolvedValueOnce({
            id: "like-2",
            actorId: "user-2",
            targetId: "user-1",
            status: "MATCHED",
            matchedAt: new Date("2026-04-17T10:01:00.000Z"),
            retractedAt: null,
            createdAt: new Date("2026-04-17T10:00:00.000Z"),
            updatedAt: new Date("2026-04-17T10:01:00.000Z"),
          }),
      } as any,
      {
        findLikeTarget: jest.fn().mockResolvedValue({
          id: "user-2",
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            isHidden: false,
            isComplete: true,
            deletedAt: null,
          },
          photos: [{ id: "photo-1" }],
        }),
        hasHistoricalMatchBetween: jest.fn().mockResolvedValue(false),
        hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
      } as any,
      {
        execute: jest.fn().mockResolvedValue({
          match: { id: "match-1" },
          conversationId: "conversation-1",
          created: true,
        }),
      } as any,
      {
        getRequiredMatch: jest.fn().mockResolvedValue({ id: "match-1" }),
        mapSummary: jest
          .fn()
          .mockReturnValue({ id: "match-1", status: "ACTIVE" }),
      } as any,
      {
        getRequiredConversation: jest
          .fn()
          .mockResolvedValue({ id: "conversation-1" }),
        mapConversationSummary: jest
          .fn()
          .mockReturnValue({
            id: "conversation-1",
            matchId: "match-1",
            status: "ACTIVE",
          }),
      } as any,
      {
        mapLike: jest.fn().mockReturnValue({
          id: "like-1",
          actorId: "user-1",
          targetId: "user-2",
          status: "MATCHED",
        }),
      } as any,
      {
        execute: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        publishSafely: jest.fn().mockResolvedValue(true),
      } as any,
      {
        enqueue: jest.fn().mockRejectedValue(new Error("queue unavailable")),
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as any,
      logger as any,
      {} as any,
    );

    const result = await service.execute({
      userId: "user-1",
      payload: {
        targetUserId: "user-2",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(result.outcome).toBe("MATCH_CREATED");
    expect(logger.error).toHaveBeenCalled();
  });
});
