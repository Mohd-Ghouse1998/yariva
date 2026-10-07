import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { ActivityService } from "../../src/modules/activity/application/activity.service";
import { ScenesService } from "../../src/modules/scenes/application/scenes.services";
import { istDay } from "../../src/modules/activity/domain/activity.domain";

const live =
  process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
live("Trusted activity: real database rewards and private recaps", () => {
  let app: NestExpressApplication, db: PrismaService, activity: ActivityService;
  const users: Array<{ id: string; token: string }> = [],
    run = randomUUID();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    app.useLogger(false);
    await app.init();
    db = app.get(PrismaService);
    activity = app.get(ActivityService);
    await db.featureFlag.upsert({
      where: { key: "activity.v1" },
      create: { key: "activity.v1", enabled: true },
      update: { enabled: true },
    });
    await db.featureFlag.upsert({
      where: { key: "scenes.v1" },
      create: { key: "scenes.v1", enabled: true },
      update: { enabled: true },
    });
    for (let i = 0; i < 10; i++) {
      const r = await request(app.getHttpServer())
        .post("/api/v1/auth/signup")
        .send({
          email: `activity-${run}-${i}@example.com`,
          password: "StrongPassw0rd!",
          device: {
            deviceId: `${run}-${i}`,
            platform: "ANDROID",
            appVersion: "test",
          },
        })
        .expect(201);
      users.push({ id: r.body.user.id, token: r.body.tokens.accessToken });
      await db.userProfile.update({
        where: { userId: r.body.user.id },
        data: {
          displayName: `Activity test ${i}`,
          isComplete: true,
          dateOfBirth: new Date("2000-01-01"),
          city: "Hyderabad",
          locationLat: 17.44,
          locationLng: 78.39,
          locationUpdatedAt: new Date(),
        },
      });
    }
  });
  afterAll(async () => {
    await app?.close();
  });
  const api = (i: number) =>
    request(app.getHttpServer())
      .get("/api/v1/activity/me")
      .set("Authorization", `Bearer ${users[i]!.token}`);
  it("hides private recap behind the rollout flag without creating a snapshot", async () => {
    const before = await db.weeklyRecap.count({
      where: { userId: users[0]!.id },
    });
    await db.featureFlag.update({
      where: { key: "activity.v1" },
      data: { enabled: false },
    });
    try {
      expect((await api(0).expect(200)).body.enabled).toBe(false);
      await request(app.getHttpServer())
        .get("/api/v1/activity/recap")
        .set("Authorization", `Bearer ${users[0]!.token}`)
        .expect(404);
      expect(
        await db.weeklyRecap.count({ where: { userId: users[0]!.id } }),
      ).toBe(before);
    } finally {
      await db.featureFlag.update({
        where: { key: "activity.v1" },
        data: { enabled: true },
      });
    }
  });
  const scene = async (i: number) =>
    db.scene.create({
      data: {
        ownerId: users[i]!.id,
        lineageId: randomUUID(),
        intent: "DATING",
        activity: "Synthetic Scene",
        canonicalActivity: "synthetic scene",
        activityTokens: ["synthetic", "scene"],
        tags: [],
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  const publish = async (i: number) => {
    const s = await scene(i);
    await db.$transaction((tx) => activity.recordScene(tx, users[i]!.id, s.id));
    return s;
  };
  it("starts at zero/null and rejects client-supplied awards and preference fields", async () => {
    expect((await api(0).expect(200)).body).toMatchObject({
      currentStreak: 0,
      longestStreak: 0,
      balance: 0,
      lastActivityDate: null,
      recapNotificationsEnabled: false,
    });
    await request(app.getHttpServer())
      .post("/api/v1/activity/award")
      .set("Authorization", `Bearer ${users[0]!.token}`)
      .send({ amount: 999 })
      .expect(404);
    await request(app.getHttpServer())
      .patch("/api/v1/activity/preferences")
      .set("Authorization", `Bearer ${users[0]!.token}`)
      .send({ balance: 999 })
      .expect(400);
    await request(app.getHttpServer()).get("/api/v1/activity/me").expect(401);
    await expect(
      db.$queryRaw`SELECT increment_user_streak(${users[0]!.id}::uuid)`,
    ).rejects.toThrow();
  });
  it("publishes through HTTP, excludes edits and dedupes same-day renewals", async () => {
    const post = () =>
      request(app.getHttpServer())
        .post("/api/v1/scenes")
        .set("Authorization", `Bearer ${users[0]!.token}`)
        .send({ intent: "DATING", activity: "Coffee and books", tags: [] });
    const s = (await post().expect(201)).body.scene;
    expect((await api(0).expect(200)).body).toMatchObject({
      currentStreak: 1,
      longestStreak: 1,
      balance: 10,
      lastActivityDate: istDay(new Date()),
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/scenes/${s.id}`)
      .set("Authorization", `Bearer ${users[0]!.token}`)
      .send({ activity: "Chai and books" })
      .expect(200);
    expect(
      await db.qualifyingActivity.count({ where: { userId: users[0]!.id } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post(`/api/v1/scenes/${s.id}/renew`)
      .set("Authorization", `Bearer ${users[0]!.token}`)
      .expect(200);
    expect(
      await db.qualifyingActivity.count({ where: { userId: users[0]!.id } }),
    ).toBe(2);
    expect(
      await db.vibePointsLedger.count({ where: { userId: users[0]!.id } }),
    ).toBe(1);
    expect((await api(0).expect(200)).body.balance).toBe(10);
  });
  it("handles yesterday, gap, cap and future stored date without spending points", async () => {
    const today = new Date(istDay(new Date())),
      day = 86400000;
    for (const [i, offset, streak, balance] of [
      [1, -1, 1, 10],
      [2, -3, 4, 100],
      [3, -1, 8, 300],
      [4, 1, 4, 100],
    ] as const) {
      await db.userStreak.create({
        data: {
          userId: users[i]!.id,
          currentStreak: streak,
          longestStreak: streak,
          balance,
          lastActivityDate: new Date(today.getTime() + offset * day),
        },
      });
      await publish(i);
    }
    expect((await api(1).expect(200)).body).toMatchObject({
      currentStreak: 2,
      balance: 30,
    });
    expect((await api(2).expect(200)).body).toMatchObject({
      currentStreak: 1,
      longestStreak: 4,
      balance: 110,
    });
    expect((await api(3).expect(200)).body).toMatchObject({
      currentStreak: 9,
      balance: 350,
    });
    expect((await api(4).expect(200)).body).toMatchObject({
      currentStreak: 0,
      balance: 100,
    });
    expect(
      await db.streakIntegrityAnomaly.count({
        where: { userId: users[4]!.id },
      }),
    ).toBe(1);
    expect(
      await db.vibePointsLedger.count({ where: { userId: users[4]!.id } }),
    ).toBe(0);
  });
  it("awards once under concurrency, trusts server time and rolls everything back", async () => {
    await Promise.all(
      Array.from({ length: 12 }, () =>
        app.get(ScenesService).create(users[5]!.id, {
          intent: "DATING",
          activity: "Concurrent test Scene",
          tags: [],
        }),
      ),
    );
    expect(
      await db.vibePointsLedger.count({ where: { userId: users[5]!.id } }),
    ).toBe(1);
    expect((await api(5).expect(200)).body.balance).toBe(10);
    const latest = await db.scene.findFirstOrThrow({
      where: { ownerId: users[5]!.id, status: "ACTIVE" },
    });
    await Promise.all(
      Array.from({ length: 5 }, () =>
        db.$transaction((tx) =>
          activity.recordScene(tx, users[5]!.id, latest.id),
        ),
      ),
    );
    expect(
      await db.qualifyingActivity.count({ where: { userId: users[5]!.id } }),
    ).toBe(12);
    const forged = await scene(6);
    await db.qualifyingActivity.create({
      data: {
        userId: users[6]!.id,
        sceneId: forged.id,
        activityDate: new Date("2099-01-01"),
        occurredAt: new Date("1900-01-01"),
      },
    });
    expect((await api(6).expect(200)).body.lastActivityDate).toBe(
      istDay(new Date()),
    );
    let rollbackId = "";
    await expect(
      db.$transaction(async (tx) => {
        const s = await tx.scene.create({
          data: {
            ownerId: users[7]!.id,
            lineageId: randomUUID(),
            intent: "DATING",
            activity: "Rollback",
            canonicalActivity: "rollback",
            activityTokens: [],
            tags: [],
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        rollbackId = s.id;
        await activity.recordScene(tx, users[7]!.id, s.id);
        throw new Error("Deliberate rollback");
      }),
    ).rejects.toThrow("Deliberate rollback");
    expect(await db.scene.findUnique({ where: { id: rollbackId } })).toBeNull();
    expect(
      await db.userStreak.findUnique({ where: { userId: users[7]!.id } }),
    ).toBeNull();
    await expect(
      db.vibePointsLedger.updateMany({
        where: { userId: users[5]!.id },
        data: { amount: 50 },
      }),
    ).rejects.toThrow();
    const wrong = await scene(8);
    await expect(
      db.$transaction((tx) => activity.recordScene(tx, users[9]!.id, wrong.id)),
    ).rejects.toThrow();
  });
  it("counts first acceptance once, snapshots truthful partial history and dedupes reports/notices", async () => {
    const [low, high] = [users[0]!.id, users[1]!.id].sort();
    const match = await db.match.create({
      data: { userLowId: low!, userHighId: high! },
    });
    const plan = await db.datePlan.create({
      data: {
        matchId: match.id,
        createdByUserId: users[0]!.id,
        status: "ACCEPTED",
        title: "Synthetic casual meetup",
        description: "Test",
        activityType: "CAFE",
        proposedStartAt: new Date(Date.now() + 3600000),
        durationMinutes: 60,
        timezone: "Asia/Kolkata",
        publicLocality: "Test area",
      },
    });
    await db.datePlan.update({
      where: { id: plan.id },
      data: { status: "PROPOSED", proposalVersion: 2 },
    });
    await db.datePlan.update({
      where: { id: plan.id },
      data: { status: "ACCEPTED" },
    });
    expect(
      await db.acceptedPlanFact.count({ where: { planId: plan.id } }),
    ).toBe(1);
    await db.userStreak.update({
      where: { userId: users[0]!.id },
      data: { recapNotificationsEnabled: true },
    });
    const cutoff = new Date("2026-10-04T14:30:00Z");
    const reports = await Promise.all(
      Array.from({ length: 4 }, () => activity.generate(users[0]!.id, cutoff)),
    );
    expect(new Set(reports.map((r) => r.id)).size).toBe(1);
    expect(reports[0]).toMatchObject({
      scenesPublished: 2,
      plansAccepted: 1,
      activityDays: 1,
      pointsEarned: 10,
      partialHistory: true,
      historyAvailable: true,
    });
    expect(
      await db.notification.count({
        where: { dedupeKey: `recap:${reports[0]!.id}` },
      }),
    ).toBe(1);
    expect(JSON.stringify(reports[0])).not.toContain(users[1]!.id);
    const zero = await activity.generate(users[9]!.id, cutoff);
    expect(zero).toMatchObject({
      scenesPublished: 0,
      plansAccepted: 0,
      activityDays: 0,
      pointsEarned: 0,
    });
    const own = (
      await request(app.getHttpServer())
        .get("/api/v1/activity/recap")
        .set("Authorization", `Bearer ${users[9]!.token}`)
        .expect(200)
    ).body.recap;
    expect(own.id).not.toBe(reports[0]!.id);
    expect(own.historyAvailable).toBe(false);
  });
});
