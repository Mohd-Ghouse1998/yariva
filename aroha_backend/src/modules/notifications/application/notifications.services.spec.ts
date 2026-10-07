import {
  CreateNotificationService,
  mapNotification,
  NotificationDispatchService,
  PushDispatcherService,
} from "./notifications.services";
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
    );

    await expect(service.dispatch(notification)).resolves.toBe("DELIVERED");
    expect(fcm.send).toHaveBeenCalledTimes(1);
    expect(apns.send).toHaveBeenCalledTimes(1);
    expect(tokens.invalidate).toHaveBeenCalledWith(
      "bad-token",
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
