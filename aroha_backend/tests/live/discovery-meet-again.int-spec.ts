import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { DiscoveryQueryRepository, DiscoverySnapshotRepository } from "../../src/modules/discovery/infrastructure/discovery.infrastructure";
import { DiscoveryPayloadMapperService } from "../../src/modules/discovery/domain/discovery.domain";
import { CreateNotificationService, NotificationDispatchService } from "../../src/modules/notifications/application/notifications.services";
import { BullmqProducer } from "../../src/integrations/bullmq/bullmq.producer";
import type { DiscoveryFeedResponseDto } from "../../src/modules/discovery/dto/discovery.dto";

const live = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
live("Discover cache privacy and Meet again transactions", () => {
  let app: NestExpressApplication, db: PrismaService, snapshots: DiscoverySnapshotRepository;
  const users: Array<{ id: string; token: string }> = [];
  const run = randomUUID();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app); app.useLogger(false); await app.init();
    db = app.get(PrismaService); snapshots = app.get(DiscoverySnapshotRepository);
    for (let i = 0; i < 6; i++) {
      const r = await request(app.getHttpServer()).post("/api/v1/auth/signup").send({
        email: `privacy-${run}-${i}@example.com`, password: "StrongPassw0rd!",
        device: { deviceId: `${run}-${i}`, platform: "ANDROID", appVersion: "test" },
      }).expect(201);
      const id: string = r.body.user.id;
      users.push({ id, token: r.body.tokens.accessToken });
      await db.userProfile.update({ where: { userId: id }, data: {
        displayName: `Privacy account ${i}`, isComplete: true, dateOfBirth: new Date("1994-01-01"),
        gender: "NON_BINARY", city: "Hyderabad", locationLat: 17.385, locationLng: 78.4867, locationUpdatedAt: new Date(),
      } });
      await db.userDiscoveryPreference.update({ where: { userId: id }, data: {
        minAge: 18, maxAge: 99, maxDistanceKm: 15, preferredGenders: [], intentFilter: ["DATING"],
      } });
      await db.userIntent.create({ data: { userId: id, intent: "DATING" } });
      await db.profilePhoto.create({ data: { userId: id, bucket: "external", objectKey: "https://example.com/fixture.jpg",
        mimeType: "image/jpeg", sizeBytes: 100, isPrimary: true, moderationStatus: "APPROVED", approvedAt: new Date() } });
    }
  });
  afterAll(async () => { await app?.close(); });
  const headers = (i: number) => ({ Authorization: `Bearer ${users[i]!.token}` });
  async function cache(viewer: number, candidates: number[]) {
    const context = await app.get(DiscoveryQueryRepository).findViewerContext(users[viewer]!.id);
    if (!context) throw new Error("Missing fixture");
    const preferenceHash = app.get(DiscoveryPayloadMapperService).mapPreferenceHash(context);
    const snapshot = { snapshotId: randomUUID(), viewerId: context.id, preferenceHash,
      candidateIds: candidates.map(i => users[i]!.id), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600_000).toISOString() };
    await snapshots.set(snapshot, 600); return snapshot;
  }
  async function feed(i: number, cursor?: string): Promise<DiscoveryFeedResponseDto> {
    const r = await request(app.getHttpServer()).get("/api/v1/discovery/feed").query({ limit: 1, cursor }).set(headers(i)).expect(200);
    return r.body;
  }
  it.each([false, true])("filters a block made after caching, reverse direction=%s", async reverse => {
    const snapshot = await cache(0, [1]);
    expect((await feed(0)).items.map(item => item.userId)).toEqual([users[1]!.id]);
    const block = await db.block.create({ data: { blockerId: users[reverse ? 1 : 0]!.id, blockedId: users[reverse ? 0 : 1]!.id } });
    try {
      expect(await snapshots.get(snapshot.viewerId, snapshot.preferenceHash)).not.toBeNull();
      expect((await feed(0)).items).toEqual([]);
    } finally { await db.block.delete({ where: { id: block.id } }); }
  });
  it("fills sparse cached pages, rechecks visibility and reciprocal preferences, and avoids duplicates", async () => {
    await cache(0, [1, 2, 3, 4, 5]);
    await db.userProfile.update({ where: { userId: users[1]!.id }, data: { isHidden: true } });
    await db.userDiscoveryPreference.update({ where: { userId: users[2]!.id }, data: { preferredGenders: ["MAN"] } });
    const page = await feed(0);
    expect(page.items.map(item => item.userId)).toEqual([users[3]!.id]);
    expect(page.nextCursor).not.toBeNull();
    await db.user.update({ where: { id: users[4]!.id }, data: { isDiscoveryFrozen: true } });
    const next = await feed(0, page.nextCursor!);
    expect(next.items.map(item => item.userId)).toEqual([users[5]!.id]);
    expect(next.nextCursor).toBeNull(); expect(next.remainingToday).toBe(0);
    await db.userProfile.update({ where: { userId: users[1]!.id }, data: { isHidden: false } });
    await db.userDiscoveryPreference.update({ where: { userId: users[2]!.id }, data: { preferredGenders: [] } });
    await db.user.update({ where: { id: users[4]!.id }, data: { isDiscoveryFrozen: false } });
  });
  it("invalidates both snapshots when blocking through the API", async () => {
    const [a, b] = await Promise.all([cache(0, [1]), cache(1, [0])]);
    await request(app.getHttpServer()).post("/api/v1/blocks").set(headers(0)).send({ blockedUserId: users[1]!.id }).expect(200);
    try {
      expect(await snapshots.get(a.viewerId, a.preferenceHash)).toBeNull();
      expect(await snapshots.get(b.viewerId, b.preferenceHash)).toBeNull();
    } finally {
      await request(app.getHttpServer()).delete(`/api/v1/blocks/${users[1]!.id}`).set(headers(0)).expect(204);
    }
  });
  it("keeps a committed block effective when cache invalidation fails", async () => {
    await cache(0, [1]);
    const invalidation = jest.spyOn(snapshots, "invalidateViewer").mockRejectedValue(new Error("cache offline"));
    try {
      await request(app.getHttpServer()).post("/api/v1/blocks").set(headers(0)).send({ blockedUserId: users[1]!.id }).expect(200);
      expect(invalidation).toHaveBeenCalledTimes(2);
      expect((await feed(0)).items).toEqual([]);
    } finally {
      invalidation.mockRestore();
      await request(app.getHttpServer()).delete(`/api/v1/blocks/${users[1]!.id}`).set(headers(0)).expect(204);
    }
  });
  async function completedPlan() {
    const [userLowId, userHighId] = [users[0]!.id, users[1]!.id].sort() as [string, string];
    const match = await db.match.upsert({ where: { userLowId_userHighId: { userLowId, userHighId } },
      create: { userLowId, userHighId }, update: { status: "ACTIVE", endedAt: null } });
    return db.datePlan.create({ data: { matchId: match.id, createdByUserId: users[0]!.id, status: "COMPLETED",
      title: "Fixture meetup", description: "Private concurrency test", activityType: "COFFEE", proposedStartAt: new Date(Date.now() - 86_400_000),
      durationMinutes: 60, timezone: "Asia/Kolkata", publicLocality: "Hyderabad", completedAt: new Date() } });
  }
  const answer = (i: number, id: string, wantsToMeetAgain: boolean) => request(app.getHttpServer())
    .post(`/api/v1/date-plans/${id}/post-date-response`).set(headers(i)).send({ wantsToMeetAgain });
  it("serializes simultaneous positive answers and durably deduplicates notifications on retries", async () => {
    const plan = await completedPlan();
    const results = await Promise.all([answer(0, plan.id, true), answer(1, plan.id, true)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(results.some(r => r.body.datePlan.meetAgainOutcome === "MUTUAL")).toBe(true);
    await Promise.all([answer(0, plan.id, true).expect(200), answer(1, plan.id, true).expect(200)]);
    const notices = await db.notification.findMany({ where: { dedupeKey: { startsWith: `MUTUAL_MEET_AGAIN:${plan.id}:` } } });
    expect(notices).toHaveLength(2);
    expect(new Set(notices.map(n => n.userId))).toEqual(new Set([users[0]!.id, users[1]!.id]));
    expect(await db.postDateCheckIn.count({ where: { datePlanId: plan.id } })).toBe(2);
  });
  it("keeps unilateral and negative answers private and rejects outsiders and inactive matches", async () => {
    const plan = await completedPlan();
    const yes = await answer(0, plan.id, true).expect(200);
    expect(yes.body.datePlan.meetAgainOutcome).toBeNull();
    const no = await answer(1, plan.id, false).expect(200);
    expect(no.body.datePlan.meetAgainOutcome).toBeNull();
    expect(JSON.stringify(no.body)).not.toContain("wantsToMeetAgain");
    expect(JSON.stringify(no.body)).not.toContain("checkIns");
    await answer(2, plan.id, true).expect(404);
    expect(await db.notification.count({ where: { dedupeKey: { startsWith: `MUTUAL_MEET_AGAIN:${plan.id}:` } } })).toBe(0);
    await db.match.update({ where: { id: plan.matchId }, data: { status: "ENDED", endedAt: new Date(), endedReason: "UNMATCHED" } });
    await answer(0, plan.id, true).expect(409);
  });
  it("recovers committed notification intents after queue failure without creating duplicates", async () => {
    const plan = await completedPlan();
    const queue = jest.spyOn(app.get(BullmqProducer), "enqueue").mockRejectedValue(new Error("queue temporarily offline"));
    try {
      await answer(0, plan.id, true).expect(200); await answer(1, plan.id, true).expect(200);
      const where = { dedupeKey: { startsWith: `MUTUAL_MEET_AGAIN:${plan.id}:` } };
      const notices = await db.notification.findMany({ where }); expect(notices).toHaveLength(2);
      expect(notices.every(n => n.status === "PENDING")).toBe(true);
      await db.notification.updateMany({ where, data: { createdAt: new Date(Date.now() - 120_000) } });
      queue.mockRestore();
      const enqueue = jest.spyOn(app.get(BullmqProducer), "enqueue");
      try {
        await app.get(CreateNotificationService).recoverPending();
        for (const notice of notices) expect(enqueue).toHaveBeenCalledWith("notification.dispatch", { notificationId: notice.id }, { jobId: `notification.dispatch:${notice.id}`, retryFinished: true });
        expect(await db.notification.count({ where })).toBe(2);
      } finally { enqueue.mockRestore(); }
      await db.match.update({ where: { id: plan.matchId }, data: { status: "ENDED", endedAt: new Date(), endedReason: "UNMATCHED" } });
      for (const notice of notices) {
        await app.get(NotificationDispatchService).execute({ notificationId: notice.id });
        expect((await db.notification.findUniqueOrThrow({ where: { id: notice.id } })).status).toBe("CANCELED");
      }
    } finally { queue.mockRestore(); }
  });

  it("rolls back both the second answer and notification intents if persistence fails", async () => {
    const plan = await completedPlan();
    await answer(0, plan.id, true).expect(200);
    const service = app.get(CreateNotificationService);
    const persist = service.persist.bind(service);
    const failure = jest.spyOn(service, "persist").mockImplementationOnce(persist)
      .mockRejectedValueOnce(new Error("notification persistence unavailable"));
    try {
      await answer(1, plan.id, true).expect(500);
      expect(await db.postDateCheckIn.count({ where: { datePlanId: plan.id } })).toBe(1);
      expect(await db.notification.count({ where: { dedupeKey: { startsWith: `MUTUAL_MEET_AGAIN:${plan.id}:` } } })).toBe(0);
    } finally { failure.mockRestore(); }
    await answer(1, plan.id, true).expect(200);
    expect(await db.notification.count({ where: { dedupeKey: { startsWith: `MUTUAL_MEET_AGAIN:${plan.id}:` } } })).toBe(2);
  });
});
