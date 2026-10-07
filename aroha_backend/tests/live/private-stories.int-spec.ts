import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { ObjectStorageService } from "../../src/integrations/object-storage/object-storage.service";
import { Prisma } from "../../src/generated/prisma/client";

const live = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
live("Private Stories authorization on PostgreSQL", () => {
  let app: NestExpressApplication, db: PrismaService, storage: ObjectStorageService;
  let previousFlag: { enabled: boolean; scope: "GLOBAL" | "USER_ALLOWLIST" | "USER_PERCENTAGE"; allowlistUserIds: Prisma.JsonValue | null } | null = null;
  const users: Array<{ id: string; token: string }> = [];
  const run = randomUUID();
  const api = (i: number) => request(app.getHttpServer());
  const auth = (i: number) => ({ Authorization: `Bearer ${users[i]!.token}` });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    app.useLogger(false);
    await app.init();
    db = app.get(PrismaService);
    storage = app.get(ObjectStorageService);
    previousFlag = await db.featureFlag.findUnique({ where: { key: "private_stories.v1" }, select: { enabled: true, scope: true, allowlistUserIds: true } });
    for (let i = 0; i < 4; i++) {
      const result = await api(i).post("/api/v1/auth/signup").send({
        email: `private-story-${run}-${i}@example.com`, password: "StrongPassw0rd!",
        device: { deviceId: `${run}-${i}`, platform: "ANDROID", appVersion: "test" },
      }).expect(201);
      users.push({ id: result.body.user.id, token: result.body.tokens.accessToken });
      await db.userProfile.update({ where: { userId: result.body.user.id }, data: { displayName: `Story test ${i}`, isComplete: true, dateOfBirth: new Date("2000-01-01") } });
    }
    await db.featureFlag.upsert({ where: { key: "private_stories.v1" }, create: { key: "private_stories.v1", enabled: true, scope: "USER_ALLOWLIST", allowlistUserIds: users.map(user => user.id) }, update: { enabled: true, scope: "USER_ALLOWLIST", allowlistUserIds: users.map(user => user.id) } });
  });
  afterAll(async () => {
    if (db && previousFlag) await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { enabled: previousFlag.enabled, scope: previousFlag.scope, allowlistUserIds: previousFlag.allowlistUserIds === null ? Prisma.DbNull : previousFlag.allowlistUserIds as Prisma.InputJsonValue } });
    else if (db) await db.featureFlag.deleteMany({ where: { key: "private_stories.v1" } });
    await app?.close();
  });

  it("requires an approved follow plus a snapshot grant, and denies guessed IDs", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(2).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(2)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[2]!.id}/approve`).set(auth(0)).expect(201);
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Only one", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
    const id = created.body.story.id;
    expect(created.body.eligibleCount).toBe(1);
    await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(200);
    await api(2).get(`/api/v1/private-stories/${id}`).set(auth(2)).expect(404);
    await api(3).get(`/api/v1/private-stories/${id}`).set(auth(3)).expect(404);
    expect((await api(2).get("/api/v1/private-stories/feed").set(auth(2)).expect(200)).body.items).toEqual([]);
    await api(0).delete(`/api/v1/private-stories/follows/followers/${users[1]!.id}`).set(auth(0)).expect(200);
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
  });

  it("snapshots all approved recipients and narrows with private community opt-in", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const first = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Approved now", audienceRule: "ALL_APPROVED" }).expect(201);
    await api(3).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(3)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[3]!.id}/approve`).set(auth(0)).expect(201);
    await api(3).get(`/api/v1/private-stories/${first.body.story.id}`).set(auth(3)).expect(404);
    const community = { identifyAs: ["GAY", "BISEXUAL", "LESBIAN"], connectWith: ["QUEER"], optedInCommunities: ["GAY"], selfDescription: null };
    await api(1).patch("/api/v1/private-stories/community").set(auth(1)).send(community).expect(200);
    expect((await api(1).get("/api/v1/private-stories/community").set(auth(1)).expect(200)).body).toMatchObject(community);
    expect((await api(2).get("/api/v1/private-stories/community").set(auth(2)).expect(200)).body.identifyAs).toEqual([]);
    const second = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Community", audienceRule: "ALL_APPROVED", communityFilter: "GAY" }).expect(201);
    expect(second.body.eligibleCount).toBe(1);
    expect((await api(1).get(`/api/v1/private-stories/${second.body.story.id}`).set(auth(1)).expect(200)).body.story.communityFilter).toBeNull();
    expect((await api(0).get(`/api/v1/private-stories/${second.body.story.id}`).set(auth(0)).expect(200)).body.story.communityFilter).toBe("GAY");
    await api(2).get(`/api/v1/private-stories/${second.body.story.id}`).set(auth(2)).expect(404);
    await api(3).get(`/api/v1/private-stories/${second.body.story.id}`).set(auth(3)).expect(404);
  });

  it("requires confirmation for audience expansion and closes access on expiry and deletion", async () => {
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Edit me", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
    const id = created.body.story.id;
    await api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({ audienceRule: "SELECTED", recipientIds: [users[1]!.id, users[2]!.id] }).expect(400);
    await api(2).get(`/api/v1/private-stories/${id}`).set(auth(2)).expect(404);
    await api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({ audienceRule: "SELECTED", recipientIds: [users[1]!.id, users[2]!.id], confirmAudienceExpansion: true }).expect(200);
    await api(2).get(`/api/v1/private-stories/${id}`).set(auth(2)).expect(200);
    await db.privateStory.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await api(2).get(`/api/v1/private-stories/${id}`).set(auth(2)).expect(404);
    const other = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Delete me", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
    await api(0).delete(`/api/v1/private-stories/${other.body.story.id}`).set(auth(0)).expect(200);
    await api(1).get(`/api/v1/private-stories/${other.body.story.id}`).set(auth(1)).expect(404);
  });

  it("keeps follow state private, deduplicates requests, and rejects reports from outsiders", async () => {
    await api(1).delete(`/api/v1/private-stories/follows/requested/${users[0]!.id}`).set(auth(1)).expect(200);
    expect((await api(1).get(`/api/v1/private-stories/follows/status/${users[0]!.id}`).set(auth(1)).expect(200)).body.status).toBe("NONE");
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    expect((await api(1).get(`/api/v1/private-stories/follows/status/${users[0]!.id}`).set(auth(1)).expect(200)).body.status).toBe("PENDING");
    const pending = (await api(0).get("/api/v1/private-stories/follows/requests").set(auth(0)).expect(200)).body;
    expect(pending.items.filter((item: { requesterId: string }) => item.requesterId === users[1]!.id)).toHaveLength(1);
    expect(JSON.stringify(pending)).not.toMatch(/optedInCommunities|identifyAs|connectWith/);
    expect((await api(2).get("/api/v1/private-stories/follows/requests").set(auth(2)).expect(200)).body.items).toEqual([]);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    expect((await api(1).get(`/api/v1/private-stories/follows/status/${users[0]!.id}`).set(auth(1)).expect(200)).body.status).toBe("APPROVED");
    const followers = (await api(0).get("/api/v1/private-stories/follows/followers").set(auth(0)).expect(200)).body;
    expect(followers.items).toContainEqual({ userId: users[1]!.id, displayName: "Story test 1" });
    expect(JSON.stringify(followers)).not.toMatch(/optedInCommunities|identifyAs|connectWith/);
    const story = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Reportable moment", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
    const report = { reportedUserId: users[0]!.id, targetType: "PRIVATE_STORY", targetPrivateStoryId: story.body.story.id, reasonCode: "INAPPROPRIATE_CONTENT" };
    await api(3).post("/api/v1/reports").set(auth(3)).send(report).expect(400);
    const accepted = await api(1).post("/api/v1/reports").set(auth(1)).send(report).expect(201);
    expect(accepted.body.report.targetType).toBe("PRIVATE_STORY");
    expect(accepted.body.moderationCaseCreated).toBe(true);
    await api(0).delete(`/api/v1/private-stories/follows/followers/${users[1]!.id}`).set(auth(0)).expect(200);
    await api(1).get(`/api/v1/private-stories/${story.body.story.id}`).set(auth(1)).expect(404);
    await api(1).post("/api/v1/reports").set(auth(1)).send({ ...report, reasonCode: "SPAM" }).expect(400);
  });

  it("signs media only after a live policy read and documents the issued-URL window", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=", "base64");
    const upload = (await api(0).post("/api/v1/private-stories/media/upload").set(auth(0)).send({ mimeType: "image/png", sizeBytes: bytes.length }).expect(201)).body;
    try {
      expect((await fetch(upload.uploadUrl, { method: "PUT", headers: upload.uploadHeaders, body: bytes })).ok).toBe(true);
      const created = (await api(0).post("/api/v1/private-stories").set(auth(0)).send({ audienceRule: "SELECTED", recipientIds: [users[1]!.id], media: { objectKey: upload.objectKey, uploadToken: upload.uploadToken, mimeType: "image/png", sizeBytes: bytes.length } }).expect(201)).body;
      const id = created.story.id;
      const recipient = (await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(200)).body.story;
      expect(recipient.mediaUrl).toContain("X-Amz-Expires=60");
      expect((await fetch(recipient.mediaUrl)).ok).toBe(true);
      const preview = (await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200)).body.items.find((item: { id: string }) => item.id === id);
      expect(preview.previewUrl).toContain("X-Amz-Expires=10");
      expect((await api(3).get("/api/v1/private-stories/feed").set(auth(3)).expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(id);
      await api(0).delete(`/api/v1/private-stories/follows/followers/${users[1]!.id}`).set(auth(0)).expect(200);
      await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
      // S3 presigned URLs cannot be revoked individually: this read may work
      // until the issued 60-second URL expires, as the UI/ADR must disclose.
      expect((await fetch(recipient.mediaUrl)).ok).toBe(true);
      await api(0).delete(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
    } finally {
      await storage.deleteObject({ bucket: "message-attachments", objectKey: upload.objectKey });
    }
  });

  it("keeps a cursor when a visible page fills before the fetched batch ends", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const ids: string[] = [];
    for (let index = 0; index < 21; index++) {
      // Seed pagination volume directly so the create-route rate limit stays in force.
      const created = await db.privateStory.create({ data: { ownerId: users[0]!.id, text: `Page ${index}`,
        audienceRule: "SELECTED", expiresAt: new Date(Date.now() + 3_600_000),
        grants: { create: [{ recipientId: users[1]!.id }] } } });
      ids.push(created.id);
    }
    const first = (await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200)).body;
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = (await api(1).get(`/api/v1/private-stories/feed?cursor=${encodeURIComponent(first.nextCursor)}`).set(auth(1)).expect(200)).body;
    const seen = [...first.items, ...second.items].map((story: { id: string }) => story.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(ids.every(id => seen.includes(id))).toBe(true);
  });

  it("closes a snapshot grant on block, unmatch and account deactivation", async () => {
    // The previous test had approved a follow. A match ending alone must not
    // revoke access while that independent relationship remains approved.
    await api(1).delete(`/api/v1/private-stories/follows/requested/${users[0]!.id}`).set(auth(1)).expect(200);
    const low = [users[0]!.id, users[1]!.id].sort()[0]!;
    const high = [users[0]!.id, users[1]!.id].sort()[1]!;
    await db.match.upsert({ where: { userLowId_userHighId: { userLowId: low, userHighId: high } }, create: { userLowId: low, userHighId: high }, update: { status: "ACTIVE", endedAt: null } });
    const story = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Match-only", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
    const id = story.body.story.id;
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(200);
    await db.block.create({ data: { blockerId: users[0]!.id, blockedId: users[1]!.id } });
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
    expect((await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(id);
    await db.block.delete({ where: { blockerId_blockedId: { blockerId: users[0]!.id, blockedId: users[1]!.id } } });
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(200);
    await db.match.update({ where: { userLowId_userHighId: { userLowId: low, userHighId: high } }, data: { status: "ENDED", endedAt: new Date() } });
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
    await db.match.update({ where: { userLowId_userHighId: { userLowId: low, userHighId: high } }, data: { status: "ACTIVE", endedAt: null } });
    await db.user.update({ where: { id: users[1]!.id }, data: { status: "SUSPENDED" } });
    // The global auth guard denies a suspended account before Story policy runs.
    await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(403);
  });

  it("keeps follow totals owner-private and reflects requests, blocks, and the independent match path", async () => {
    const owner = users[0]!.id;
    const requester = users[2]!.id;
    const other = users[3]!.id;
    await db.privateFollow.deleteMany({ where: { ownerId: owner } });
    const summary = (i: number) => api(i).get("/api/v1/private-stories/follows/summary").set(auth(i)).expect(200);
    expect((await summary(0)).body).toEqual({ followers: 0, following: 0, requests: 0 });
    await api(2).post(`/api/v1/private-stories/follows/${owner}`).set(auth(2)).expect(201);
    await api(3).post(`/api/v1/private-stories/follows/${owner}`).set(auth(3)).expect(201);
    expect((await summary(0)).body).toEqual({ followers: 0, following: 0, requests: 2 });
    expect((await api(2).get(`/api/v1/private-stories/follows/summary?userId=${owner}`).set(auth(2)).expect(200)).body).toEqual({ followers: 0, following: 0, requests: 0 });
    expect((await api(2).get("/api/v1/private-stories/follows/followers").set(auth(2)).expect(200)).body.items).toEqual([]);
    await api(0).post(`/api/v1/private-stories/follows/${requester}/approve`).set(auth(0)).expect(201);
    expect((await summary(0)).body).toEqual({ followers: 1, following: 0, requests: 1 });
    expect((await summary(2)).body.following).toBe(1);
    await api(0).get("/api/v1/private-stories/follows/followers?cursor=bad").set(auth(0)).expect(400);

    await db.block.create({ data: { blockerId: owner, blockedId: requester } });
    expect((await summary(0)).body).toEqual({ followers: 0, following: 0, requests: 1 });
    expect((await api(0).get("/api/v1/private-stories/follows/followers").set(auth(0)).expect(200)).body.items).toEqual([]);
    await db.block.delete({ where: { blockerId_blockedId: { blockerId: owner, blockedId: requester } } });
    expect((await summary(0)).body.followers).toBe(1);

    const low = [owner, requester].sort()[0]!;
    const high = [owner, requester].sort()[1]!;
    await db.match.upsert({ where: { userLowId_userHighId: { userLowId: low, userHighId: high } }, create: { userLowId: low, userHighId: high }, update: { status: "ACTIVE", endedAt: null } });
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Follow and match", audienceRule: "SELECTED", recipientIds: [requester] }).expect(201);
    const storyId = created.body.story.id;
    await api(2).delete(`/api/v1/private-stories/follows/requested/${owner}`).set(auth(2)).expect(200);
    expect((await summary(0)).body.followers).toBe(0);
    await api(2).get(`/api/v1/private-stories/${storyId}`).set(auth(2)).expect(200);
    await db.match.update({ where: { userLowId_userHighId: { userLowId: low, userHighId: high } }, data: { status: "ENDED", endedAt: new Date() } });
    await api(2).get(`/api/v1/private-stories/${storyId}`).set(auth(2)).expect(404);
    await api(0).delete(`/api/v1/private-stories/follows/followers/${other}`).set(auth(0)).expect(200);
    expect((await summary(0)).body.requests).toBe(0);
  });

  it("keeps follows available when private Stories are disabled", async () => {
    await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { enabled: false } });
    try {
      expect((await api(0).get("/api/v1/private-stories/capabilities").set(auth(0)).expect(200)).body.enabled).toBe(false);
      await api(0).get("/api/v1/private-stories/feed").set(auth(0)).expect(404);
      await api(3).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(3)).expect(201);
      expect((await api(0).get("/api/v1/private-stories/follows/summary").set(auth(0)).expect(200)).body.requests).toBe(1);
      await api(0).post(`/api/v1/private-stories/follows/${users[3]!.id}/approve`).set(auth(0)).expect(201);
      expect((await api(0).get("/api/v1/private-stories/follows/followers").set(auth(0)).expect(200)).body.items)
        .toContainEqual({ userId: users[3]!.id, displayName: "Story test 3" });
      expect((await api(3).get("/api/v1/private-stories/follows/following").set(auth(3)).expect(200)).body.items)
        .toContainEqual({ userId: users[0]!.id, displayName: "Story test 0" });
      await api(3).delete(`/api/v1/private-stories/follows/requested/${users[0]!.id}`).set(auth(3)).expect(200);
    } finally {
      await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { enabled: true } });
    }
  });
});
