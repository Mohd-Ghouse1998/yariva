import {
  CreateNotificationService,
  ListNotificationsService,
  MarkNotificationReadService,
  mapNotification,
  NotificationDispatchService,
  PushDispatcherService,
} from "./notifications.services";
import { PrivateStoriesService } from "../../private-stories/application/private-stories.service";
import { NotificationOwnershipPolicy } from "../domain/notifications.domain";
import type { PrismaService } from "../../../database/prisma/prisma.service";
import type { NotificationRepository } from "../infrastructure/notifications.infrastructure";
import type { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";

describe("NotificationDispatchService", () => {
  it.each([
    [false, true],
    [true, false],
  ])(
    "cancels a queued recap when consent=%s and rollout=%s",
    async (consent, enabled) => {
      const transaction = {};
      const prisma = {
        userStreak: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ recapNotificationsEnabled: consent }),
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn(transaction),
        ),
      };
      const repository = {
        findById: jest
          .fn()
          .mockResolvedValue({
            id: "recap-notice",
            userId: "owner",
            status: "PENDING",
            deletedAt: null,
            data: { route: "weekly-recap" },
          }),
        markCanceled: jest.fn().mockResolvedValue(undefined),
      };
      const dispatcher = { dispatch: jest.fn() };
      const service = new NotificationDispatchService(
        prisma as unknown as PrismaService,
        repository as unknown as NotificationRepository,
        dispatcher as unknown as PushDispatcherService,
        {} as CreateNotificationService,
        {
          execute: jest.fn().mockResolvedValue({ enabled }),
        } as unknown as EvaluateFeatureFlagService,
        {} as PrivateStoriesService,
      );
      await service.execute({ notificationId: "recap-notice" });
      expect(repository.markCanceled).toHaveBeenCalledWith(
        transaction,
        "recap-notice",
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    },
  );
  it("turns legacy match dispatch jobs into durable notifications", async () => {
    const createNotificationService = {
      execute: jest.fn().mockResolvedValue({ created: true }),
    };
    const service = new NotificationDispatchService(
      {} as any,
      {} as any,
      {} as any,
      createNotificationService as any,
      {} as EvaluateFeatureFlagService,
      {} as PrivateStoriesService,
    );

    await service.execute({
      type: "NEW_MATCH",
      recipientUserId: "user-2",
      actorUserId: "user-1",
      matchId: "match-1",
      conversationId: "conversation-1",
    });

    expect(createNotificationService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        actorUserId: "user-1",
        type: "NEW_MATCH",
        dedupeKey: "NEW_MATCH:match-1:user-2",
      }),
    );
  });
});

describe("mapNotification", () => {
  it("exposes stable actor identity without deriving it from notification copy", () => {
    const createdAt = new Date("2026-08-30T10:00:00.000Z");
    const mapped = mapNotification({
      id: "notification-1",
      userId: "recipient-1",
      actorUserId: "actor-1",
      actorUser: {
        id: "actor-1",
        profile: { displayName: "Asha Rao" },
      },
      type: "NEW_MESSAGE",
      channel: "IN_APP",
      title: "Asha sent a message",
      body: "Hello",
      data: {},
      status: "PENDING",
      dedupeKey: null,
      readAt: null,
      sentAt: null,
      failedAt: null,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    } as any);

    expect(mapped.actor).toEqual({
      userId: "actor-1",
      displayName: "Asha Rao",
    });
  });
});

describe("PushDispatcherService", () => {
  const notification = {
    id: "notification-1",
    userId: "user-1",
    type: "NEW_MATCH",
    channel: "PUSH",
    title: "New match",
    body: "You matched",
    data: { matchId: "match-1" },
  } as any;

  it("honors preferences without calling a provider", async () => {
    const tokens = {
      listDispatchableForUser: jest
        .fn()
        .mockResolvedValue([{ id: "token-1", provider: "FCM" }]),
      findPreferences: jest.fn().mockResolvedValue({ allowPushMatches: false }),
    };
    const fcm = { send: jest.fn() };
    const service = new PushDispatcherService(
      tokens as any,
      { sentTokenIds: jest.fn().mockResolvedValue(new Set()) } as any,
      fcm as any,
      { send: jest.fn() } as any,
      { warn: jest.fn() } as any,
      {} as PrivateStoriesService,
      {} as PrismaService,
    );

    await expect(service.dispatch(notification)).resolves.toBe("SUPPRESSED");
    expect(fcm.send).not.toHaveBeenCalled();
  });

  it("records delivery, invalidates bad tokens, and skips already-sent token deliveries", async () => {
    const tokens = {
      listDispatchableForUser: jest.fn().mockResolvedValue([
        { id: "sent-token", token: "already", provider: "FCM" },
        { id: "good-token", token: "good", provider: "FCM" },
        { id: "bad-token", token: "bad", provider: "APNS" },
      ]),
      findPreferences: jest.fn().mockResolvedValue({
        allowPushMatches: true,
        allowPushMessages: true,
        allowPushCalls: true,
      }),
      invalidate: jest.fn().mockResolvedValue(undefined),
    };
    const deliveries = {
      sentTokenIds: jest.fn().mockResolvedValue(new Set(["sent-token"])),
      record: jest.fn().mockResolvedValue(undefined),
    };
    const fcm = {
      send: jest
        .fn()
        .mockResolvedValue({
          outcome: "DELIVERED",
          providerMessageId: "fcm-1",
        }),
    };
    const apns = {
      send: jest
        .fn()
        .mockResolvedValue({
          outcome: "INVALID_TOKEN",
          reason: "Unregistered",
        }),
    };
    const service = new PushDispatcherService(
      tokens as any,
      deliveries as any,
      fcm as any,
      apns as any,
      { warn: jest.fn() } as any,
      {} as PrivateStoriesService,
      {} as PrismaService,
    );

    await expect(service.dispatch(notification)).resolves.toBe("DELIVERED");
    expect(fcm.send).toHaveBeenCalledTimes(1);
    expect(apns.send).toHaveBeenCalledTimes(1);
    expect(tokens.invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bad-token" }),
      expect.any(Date),
    );
    expect(deliveries.record).toHaveBeenCalledWith(
      expect.objectContaining({ pushTokenId: "good-token", status: "SENT" }),
    );
    expect(deliveries.record).toHaveBeenCalledWith(
      expect.objectContaining({ pushTokenId: "bad-token", status: "INVALID" }),
    );
  });
});

describe("private Story notifications", () => {
  const notice = {
    id: "notice", userId: "recipient", actorUserId: null, type: "SYSTEM", channel: "PUSH",
    title: "New update", body: "A private Story is available in Yariva.",
    data: { route: "private-story", storyId: "story" }, status: "PENDING", deletedAt: null,
    createdAt: new Date(), updatedAt: new Date(), readAt: null, sentAt: null,
  } as any;
  const stories = (canAccess: jest.Mock) => ({ canAccess }) as unknown as PrivateStoriesService;
  const prisma = { $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})) };

  it("scans past revoked notices and keeps the repository cursor for later activity", async () => {
    const repository = { listByUser: jest.fn()
      .mockResolvedValueOnce({ items: [notice], nextCursor: "after-denied" })
      .mockResolvedValueOnce({ items: [{ ...notice, id: "ordinary", data: {} }], nextCursor: "next" }) };
    const canAccess = jest.fn().mockResolvedValue(false);
    const result = await new ListNotificationsService(repository as any, stories(canAccess), {} as PrismaService)
      .execute({ userId: "recipient", limit: 1 });
    expect(result.items.map(item => item.id)).toEqual(["ordinary"]);
    expect(result.nextCursor).toBe("next");
    expect(repository.listByUser).toHaveBeenLastCalledWith({ userId: "recipient", limit: 1, cursor: "after-denied" });
    expect(canAccess).toHaveBeenCalledWith("recipient", "story", {});
  });

  it("fails closed before persisting or publishing an inaccessible Story notice", async () => {
    const intents = { persist: jest.fn(), dispatchPersisted: jest.fn() };
    const service = new CreateNotificationService(prisma as any, intents as any,
      stories(jest.fn().mockResolvedValue(false)));
    await expect(service.execute(notice)).rejects.toMatchObject({ status: 404 });
    expect(intents.persist).not.toHaveBeenCalled();
    expect(intents.dispatchPersisted).not.toHaveBeenCalled();
  });

  it("rechecks Story access after commit before publishing or enqueueing the notice", async () => {
    const intents = { persist: jest.fn().mockResolvedValue({ notification: notice, created: true }),
      dispatchPersisted: jest.fn() };
    const canAccess = jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    const service = new CreateNotificationService(prisma as any, intents as any, stories(canAccess));
    await service.execute(notice);
    expect(intents.persist).toHaveBeenCalledTimes(1);
    expect(canAccess).toHaveBeenCalledTimes(2);
    expect(canAccess).toHaveBeenLastCalledWith("recipient", "story", prisma);
    expect(intents.dispatchPersisted).not.toHaveBeenCalled();
  });

  it("does not return a stale notice from the mark-read endpoint", async () => {
    const repository = { findById: jest.fn().mockResolvedValue(notice), markRead: jest.fn() };
    const service = new MarkNotificationReadService(prisma as any, repository as any,
      new NotificationOwnershipPolicy(), {} as any, stories(jest.fn().mockResolvedValue(false)));
    await expect(service.execute({ userId: "recipient", notificationId: "notice" })).rejects.toMatchObject({ status: 404 });
    expect(repository.markRead).not.toHaveBeenCalled();
  });

  it("cancels a queued notice when the Story policy denies access", async () => {
    const repository = { findById: jest.fn().mockResolvedValue(notice), markCanceled: jest.fn() };
    const push = { dispatch: jest.fn() };
    const service = new NotificationDispatchService(prisma as any, repository as any, push as any,
      {} as any, {} as any, stories(jest.fn().mockResolvedValue(false)));
    await service.execute({ notificationId: "notice" });
    expect(repository.markCanceled).toHaveBeenCalledWith({}, "notice");
    expect(push.dispatch).not.toHaveBeenCalled();
  });

  it("creates generic deduplicated notices only for currently authorized grantees", async () => {
    const create = { execute: jest.fn() };
    const db = { privateStoryGrant: { findMany: jest.fn().mockResolvedValue([{ recipientId: "recipient" }, { recipientId: "revoked" }]) } };
    const service = new NotificationDispatchService(db as any, {} as any, {} as any, create as any,
      {} as any, stories(jest.fn(async userId => userId === "recipient")));
    await service.execute({ type: "PRIVATE_STORY_SHARED", storyId: "story" });
    expect(create.execute).toHaveBeenCalledTimes(1);
    expect(create.execute).toHaveBeenCalledWith({ userId: "recipient", type: "SYSTEM",
      title: "New update", body: "A private Story is available in Yariva.",
      data: { route: "private-story", storyId: "story" }, dedupeKey: "private-story:story:recipient" });
  });

  it("rechecks access between provider attempts and never sends to the next token after revoke", async () => {
    const canAccess = jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    const send = jest.fn().mockResolvedValue({ outcome: "DELIVERED", providerMessageId: "one" });
    const service = new PushDispatcherService({
      listDispatchableForUser: jest.fn().mockResolvedValue([
        { id: "one", token: "one", provider: "FCM" }, { id: "two", token: "two", provider: "FCM" },
      ]), findPreferences: jest.fn().mockResolvedValue(null),
    } as any, { sentTokenIds: jest.fn().mockResolvedValue(new Set()), record: jest.fn() } as any,
    { send } as any, {} as any, {} as any, stories(canAccess), {} as PrismaService);
    await expect(service.dispatch(notice)).resolves.toBe("SUPPRESSED");
    expect(send).toHaveBeenCalledTimes(1);
    expect(canAccess).toHaveBeenCalledTimes(2);
  });
});
