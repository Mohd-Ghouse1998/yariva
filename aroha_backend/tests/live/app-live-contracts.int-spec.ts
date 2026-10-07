import { getQueueToken } from "@nestjs/bullmq";
import { NestFactory } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { INestApplicationContext } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Queue } from "bullmq";
import request from "supertest";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { BullmqProducer } from "../../src/integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../src/integrations/object-storage/object-storage.service";
import { RedisService } from "../../src/integrations/redis/redis.service";
import { JobsModule } from "../../src/jobs/jobs.module";

const describeLive =
  process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;

describeLive("live AppModule production contracts", () => {
  let app: NestExpressApplication;
  let jobsApp: INestApplicationContext;
  let prisma: PrismaService;
  let redis: RedisService;
  let objectStorage: ObjectStorageService;
  let producer: BullmqProducer;
  let queue: Queue;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    await app.init();

    jobsApp = await NestFactory.createApplicationContext(JobsModule, {
      bufferLogs: true,
    });

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    objectStorage = app.get(ObjectStorageService);
    producer = app.get(BullmqProducer);
    queue = jobsApp.get<Queue>(getQueueToken("default"));
  });

  afterAll(async () => {
    await jobsApp?.close();
    await app?.close();
  });

  it("runs major REST contracts through the real app, database, Redis, and queue wiring", async () => {
    const admin = await signup(`live-admin-${runId}@example.com`);
    const user = await signup(`live-user-${runId}@example.com`);

    await prisma.user.update({
      where: { id: admin.userId },
      data: { role: "ADMIN" },
    });

    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.user.id).toBe(admin.userId);
      });

    await request(app.getHttpServer())
      .patch("/api/v1/profiles/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        displayName: "Live Admin",
        headline: "Production readiness smoke user",
        bio: "This profile has enough detail to exercise real profile validation.",
        dateOfBirth: "1994-01-01T00:00:00.000Z",
        gender: "WOMAN",
        city: "San Francisco",
        region: "CA",
        countryCode: "US",
        location: {
          lat: 37.7749,
          lng: -122.4194,
        },
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/analytics/events")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        events: [
          {
            clientEventId: `live-${runId}`,
            eventName: "live.integration.smoke",
            occurredAt: new Date().toISOString(),
            source: "MOBILE",
            properties: { runId },
          },
        ],
      })
      .expect(202)
      .expect((response) => {
        expect(response.body.acceptedCount).toBe(1);
      });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/feature-flags/live-hardening-${runId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        description: "Live hardening test flag",
        scope: "GLOBAL",
        enabled: true,
        rolloutPercentage: null,
        variant: null,
        config: { runId },
        allowlistUserIds: [],
      })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/admin/analytics/summary?window=24h")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.window).toBe("24h");
        expect(response.body.metrics).toBeDefined();
      });

    await request(app.getHttpServer())
      .post("/api/v1/reports")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        reportedUserId: user.userId,
        targetType: "USER",
        reasonCode: "SPAM",
        description: "Live integration report",
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.report.reportedUserId).toBe(user.userId);
        expect(response.body.moderationCaseCreated).toBe(true);
      });

    await request(app.getHttpServer())
      .post("/api/v1/blocks")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        blockedUserId: user.userId,
        reason: "Live integration block",
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/blocks/${user.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body.items)).toBe(true);
      });
  });

  it("exercises live Redis, BullMQ worker processing, and S3-compatible object storage", async () => {
    const redisKey = `live:${runId}`;
    await redis.set(redisKey, "ok", "EX", 60);
    await expect(redis.get(redisKey)).resolves.toBe("ok");

    const objectKey = `live/${runId}.txt`;
    const upload = await objectStorage.createPresignedPutObject({
      bucket: "message-attachments",
      objectKey,
      mimeType: "text/plain",
      uploadToken: `upload-${runId}`,
      userId: "00000000-0000-4000-8000-000000000001",
      sha256: null,
      expiresInSeconds: 300,
    });
    expect(upload.uploadUrl).toContain("message-attachments");

    const putResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: Buffer.from("hello"),
    });
    if (putResponse.status < 200 || putResponse.status >= 300) {
      throw new Error(
        `Presigned PUT failed with ${putResponse.status}: ${await putResponse.text()}`,
      );
    }

    const headed = await objectStorage.headObject({
      bucket: "message-attachments",
      objectKey,
    });
    expect(headed.sizeBytes).toBe(5);
    expect(headed.mimeType).toBe("text/plain");

    const jobId = `live-analytics-rollup-${runId}`;
    await producer.enqueue("analytics.rollup", { window: "24h" }, { jobId });
    await waitForJobCompletion(queue, jobId);
  });

  it("enforces PostGIS Scene distance, point ordering, and concurrent active replacement", async () => {
    await prisma.featureFlag.upsert({
      where: { key: "scenes.v1" },
      create: {
        key: "scenes.v1",
        scope: "GLOBAL",
        enabled: true,
        allowlistUserIds: [],
        config: { radiusMeters: 15000, lifetimeHours: 12 },
      },
      update: { enabled: true, deletedAt: null },
    });

    const first = await signup(`live-scene-a-${runId}@example.com`);
    const second = await signup(`live-scene-b-${runId}@example.com`);
    await Promise.all([
      prepareSceneProfile(first.userId, "Scene A", 17.385, 78.4867),
      prepareSceneProfile(second.userId, "Scene B", 17.386, 78.4867),
    ]);

    const point = await prisma.$queryRaw<Array<{ lng: number; lat: number }>>`
      SELECT
        ST_X("locationPoint"::geometry)::double precision AS lng,
        ST_Y("locationPoint"::geometry)::double precision AS lat
      FROM "UserProfile" WHERE "userId" = ${first.userId}::uuid
    `;
    expect(point[0]).toEqual({ lng: 78.4867, lat: 17.385 });

    const boundaries = await prisma.$queryRaw<
      Array<{ at149: boolean; at150: boolean; at151: boolean }>
    >`
      WITH origin AS (
        SELECT ST_SetSRID(ST_MakePoint(78.4867, 17.385), 4326)::geography AS g
      )
      SELECT
        ST_DWithin(g, ST_Project(g, 14900, radians(90)), 15000) AS "at149",
        ST_DWithin(g, ST_Project(g, 15000, radians(90)), 15000) AS "at150",
        ST_DWithin(g, ST_Project(g, 15100, radians(90)), 15000) AS "at151"
      FROM origin
    `;
    expect(boundaries[0]).toEqual({ at149: true, at150: true, at151: false });

    const [sceneA, sceneB] = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/scenes")
        .set("Authorization", `Bearer ${first.accessToken}`)
        .send({ intent: "DATING", activity: "Coffee and books", tags: ["quiet"] })
        .expect(201),
      request(app.getHttpServer())
        .post("/api/v1/scenes")
        .set("Authorization", `Bearer ${second.accessToken}`)
        .send({ intent: "DATING", activity: "Chai with a book", tags: ["quiet"] })
        .expect(201),
    ]);
    expect(sceneA.body.scene.expiresAt).toBeDefined();
    expect(sceneB.body.scene.expiresAt).toBeDefined();

    await request(app.getHttpServer())
      .get("/api/v1/scenes/discover")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.items.map((item: any) => item.profile.userId)).toContain(
          second.userId,
        );
        expect(response.body.items[0].profile).not.toHaveProperty("locationLat");
        expect(response.body.items[0].profile).not.toHaveProperty("locationLng");
      });

    await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/scenes")
        .set("Authorization", `Bearer ${first.accessToken}`)
        .send({ intent: "DATING", activity: "Movie night" })
        .expect(201),
      request(app.getHttpServer())
        .post("/api/v1/scenes")
        .set("Authorization", `Bearer ${first.accessToken}`)
        .send({ intent: "FRIENDSHIP", activity: "KBR Park walk" })
        .expect(201),
    ]);
    await expect(
      prisma.scene.count({ where: { ownerId: first.userId, status: "ACTIVE" } }),
    ).resolves.toBe(1);
  });

  async function signup(email: string): Promise<{
    userId: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({
        email,
        password: "StrongPassw0rd!",
        device: {
          deviceId: `device-${email}`,
          deviceName: "Live integration",
          platform: "WEB",
          appVersion: "test",
        },
      })
      .expect(201);

    return {
      userId: response.body.user.id,
      accessToken: response.body.tokens.accessToken,
      refreshToken: response.body.tokens.refreshToken,
    };
  }

  async function prepareSceneProfile(
    userId: string,
    displayName: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        displayName,
        headline: "Live Scene integration profile",
        bio: "A complete adult test profile for private Scene matching.",
        dateOfBirth: new Date("1994-01-01T00:00:00.000Z"),
        gender: "NON_BINARY",
        city: "Hyderabad",
        region: "Telangana",
        countryCode: "IN",
        locationLat: lat,
        locationLng: lng,
        locationUpdatedAt: new Date(),
        isComplete: true,
        completedAt: new Date(),
      },
    });
    await prisma.userDiscoveryPreference.upsert({
      where: { userId },
      create: {
        userId,
        minAge: 18,
        maxAge: 99,
        maxDistanceKm: 15,
        preferredGenders: [],
      },
      update: { minAge: 18, maxAge: 99, preferredGenders: [] },
    });
  }
});

async function waitForJobCompletion(queue: Queue, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const job = await queue.getJob(jobId);
    const state = await job?.getState();
    if (state === "completed") {
      return;
    }
    if (state === "failed") {
      throw new Error(`Job ${jobId} failed: ${job?.failedReason ?? "unknown"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}
