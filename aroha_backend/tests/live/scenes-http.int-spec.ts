import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";

const describeLive =
  process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;

describeLive("Scene HTTP vertical slice", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.featureFlag.update({
      where: { key: "scenes.v1" },
      data: { enabled: true, scope: "GLOBAL" },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("publishes, discovers, revalidates privacy cache, and mutually matches two accounts", async () => {
    const first = await signup(`scene-http-a-${runId}@example.com`);
    const second = await signup(`scene-http-b-${runId}@example.com`);
    const [firstPhotoId, secondPhotoId] = await Promise.all([
      prepare(first.userId, "Asha", 17.385, 78.4867),
      prepare(second.userId, "Mira", 17.386, 78.4867),
    ]);

    const firstScene = await postScene(first.accessToken, "Coffee and books", firstPhotoId);
    const secondScene = await postScene(second.accessToken, "Chai with a book", secondPhotoId);
    expect(firstScene.photo).toMatchObject({ id: firstPhotoId });

    await request(app.getHttpServer())
      .patch(`/api/v1/scenes/${firstScene.id}`)
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({ photoId: secondPhotoId })
      .expect(400)
      .expect((response) => expect(response.body.error.code).toBe("SCENE_INVALID_PHOTO"));

    await request(app.getHttpServer())
      .get(`/api/v1/scenes/users/${second.userId}`)
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200)
      .expect((response) => expect(response.body.scene.id).toBe(secondScene.id));

    await request(app.getHttpServer())
      .get("/api/v1/scenes/discover")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200)
      .expect((response) => {
        const candidate = response.body.items.find(
          (item: any) => item.profile.userId === second.userId,
        );
        expect(candidate).toBeDefined();
        expect(candidate.scene.photo).toMatchObject({ id: secondPhotoId });
        expect(candidate.availability).toBe("UNCONFIRMED");
        expect(JSON.stringify(response.body)).not.toContain("locationLat");
        expect(JSON.stringify(response.body)).not.toContain("locationLng");
      });

    const block = await prisma.block.create({
      data: { blockerId: first.userId, blockedId: second.userId },
    });
    await request(app.getHttpServer())
      .get("/api/v1/scenes/discover")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200)
      .expect((response) =>
        expect(response.body.items.map((item: any) => item.profile.userId)).not.toContain(
          second.userId,
        ),
      );
    await prisma.block.update({ where: { id: block.id }, data: { deletedAt: new Date() } });

    await prisma.userProfile.update({
      where: { userId: second.userId },
      data: { isHidden: true },
    });
    await expectCandidateAbsent(first.accessToken, second.userId);
    await prisma.userProfile.update({
      where: { userId: second.userId },
      data: { isHidden: false, locationUpdatedAt: new Date("2025-01-01T00:00:00.000Z") },
    });
    await expectCandidateAbsent(first.accessToken, second.userId);
    await prisma.userProfile.update({
      where: { userId: second.userId },
      data: { locationUpdatedAt: new Date() },
    });

    const firstPage = await request(app.getHttpServer())
      .get("/api/v1/scenes/discover?limit=1")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);
    if (firstPage.body.nextCursor) {
      const secondPage = await request(app.getHttpServer())
        .get(`/api/v1/scenes/discover?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
        .set("Authorization", `Bearer ${first.accessToken}`)
        .expect(200);
      expect(secondPage.body.items[0]?.scene.id).not.toBe(firstPage.body.items[0]?.scene.id);
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/scenes/${secondScene.id}`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .send({ activity: "Movie night" })
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/v1/scenes/discover")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200)
      .expect((response) =>
        expect(response.body.items.map((item: any) => item.profile.userId)).not.toContain(
          second.userId,
        ),
      );
    await request(app.getHttpServer())
      .patch(`/api/v1/scenes/${secondScene.id}`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .send({ activity: "Coffee and books" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/likes")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .set("Idempotency-Key", `scene-like-a-${runId}`)
      .send({ targetUserId: second.userId })
      .expect(200)
      .expect((response) => expect(response.body.outcome).toBe("LIKE_RECORDED"));
    await request(app.getHttpServer())
      .post("/api/v1/likes")
      .set("Authorization", `Bearer ${second.accessToken}`)
      .set("Idempotency-Key", `scene-like-b-${runId}`)
      .send({ targetUserId: first.userId })
      .expect(200)
      .expect((response) => expect(response.body.outcome).toBe("MATCH_CREATED"));

    const endedSecond = await request(app.getHttpServer())
      .post(`/api/v1/scenes/${secondScene.id}/end`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(200);
    expect(endedSecond.body.scene.status).toBe("ENDED");
    const renewedSecond = await request(app.getHttpServer())
      .post(`/api/v1/scenes/${secondScene.id}/renew`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(200);
    expect(renewedSecond.body.scene).toMatchObject({
      status: "ACTIVE",
      version: endedSecond.body.scene.version + 1,
      lineageId: endedSecond.body.scene.lineageId,
      photo: { id: secondPhotoId },
    });
    expect(renewedSecond.body.scene.id).not.toBe(secondScene.id);

    await prisma.scene.update({ where: { id: firstScene.id }, data: { expiresAt: new Date() } });
    await request(app.getHttpServer())
      .get("/api/v1/scenes/discover")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(409);
    await expect(prisma.scene.findUnique({ where: { id: firstScene.id } })).resolves.toMatchObject({
      status: "EXPIRED",
    });
  });

  async function signup(email: string): Promise<{ userId: string; accessToken: string }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({
        email,
        password: "StrongPassw0rd!",
        device: { deviceId: `device-${email}`, platform: "ANDROID", appVersion: "test" },
      })
      .expect(201);
    return { userId: response.body.user.id, accessToken: response.body.tokens.accessToken };
  }

  async function prepare(
    userId: string,
    displayName: string,
    lat: number,
    lng: number,
  ): Promise<string> {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        displayName,
        headline: "Scene integration account",
        bio: "An adult integration account with private location data.",
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
      create: { userId, minAge: 18, maxAge: 99, maxDistanceKm: 15, preferredGenders: [] },
      update: { minAge: 18, maxAge: 99, preferredGenders: [] },
    });
    const photo = await prisma.profilePhoto.create({
      data: {
        userId,
        bucket: "external",
        objectKey: "https://example.com/test.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        isPrimary: true,
        moderationStatus: "APPROVED",
        approvedAt: new Date(),
      },
    });
    return photo.id;
  }

  async function postScene(
    accessToken: string,
    activity: string,
    photoId?: string,
  ): Promise<{ id: string; photo: { id: string } | null }> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/scenes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ intent: "DATING", activity, photoId })
      .expect(201);
    return response.body.scene;
  }

  async function expectCandidateAbsent(accessToken: string, userId: string): Promise<void> {
    await request(app.getHttpServer())
      .get("/api/v1/scenes/discover")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) =>
        expect(response.body.items.map((item: any) => item.profile.userId)).not.toContain(userId),
      );
  }
});
