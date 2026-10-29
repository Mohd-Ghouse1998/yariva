import { PrivateStoryCleanupProcessor } from "../../src/jobs/private-stories/private-story-cleanup.processor";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage, type ThrottlerStorageService } from "@nestjs/throttler";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { Client } from "pg";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { ObjectStorageService } from "../../src/integrations/object-storage/object-storage.service";
import { Prisma } from "../../src/generated/prisma/client";
import { CreateNotificationService, NotificationDispatchService } from "../../src/modules/notifications/application/notifications.services";
import { BullmqProducer } from "../../src/integrations/bullmq/bullmq.producer";
import { PrivateStoriesService } from "../../src/modules/private-stories/application/private-stories.service";
import { NotificationIntentService } from "../../src/modules/notifications/application/notification-intent.service";
import vibesConfig from "../../src/config/vibes.config";
import { probeMedia, runMediaTool } from "../../src/jobs/vibes/vibe-media.processor";

const live = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
live("Private Stories authorization on PostgreSQL", () => {
  let app: NestExpressApplication, db: PrismaService, storage: ObjectStorageService;
  let previousFlag: { enabled: boolean; scope: "GLOBAL" | "USER_ALLOWLIST" | "USER_PERCENTAGE"; allowlistUserIds: Prisma.JsonValue | null } | null = null;
  const users: Array<{ id: string; token: string }> = [];
  const run = randomUUID();
  const api = (i: number) => request(app.getHttpServer());
  const auth = (i: number) => ({ Authorization: `Bearer ${users[i]!.token}` });
  // Each case exercises the real route throttles; reset only their in-memory
  // counters so earlier cases cannot turn a later authorization check into 429.
  beforeEach(() => {
    if (!app) return;
    for (const record of app.get<ThrottlerStorageService>(ThrottlerStorage).storage.values()) {
      record.isBlocked = false;
      for (const name of record.totalHits.keys()) record.totalHits.set(name, 0);
    }
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    app.useLogger(false);
    // Keep one listener alive: Supertest otherwise closes its temporary server
    // when the first request finishes, racing concurrent requests in the sample.
    await app.listen(0, "127.0.0.1");
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

  describe("optional owner archive", () => {
    const ids: string[] = [];
    const make = async (data: Partial<Prisma.PrivateStoryUncheckedCreateInput> = {}) => {
      const row = await db.privateStory.create({ data: { ownerId: users[0]!.id, text: "Archive acceptance",
        audienceRule: "SELECTED", moderationStatus: "APPROVED", expiresAt: new Date(Date.now() + 86_400_000), ...data } });
      ids.push(row.id); return row;
    };
    const save = (id: string, saved: boolean, who = 0) => api(who).patch(`/api/v1/private-stories/${id}/saved`).set(auth(who)).send({ saved });
    const read = (kind: "me" | "saved" | "feed", who = 0, cursor?: string) => api(who).get(`/api/v1/private-stories/${kind}`).set(auth(who)).query(cursor ? { cursor } : {}).expect(200);
    afterEach(async () => {
      await db.privateStory.deleteMany({ where: { id: { in: ids.splice(0) } } });
      await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: users[1]!.id } });
    });

    it("defaults off, persists explicit saves, and keeps expired archives owner-only on every read", async () => {
      await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
      await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
      const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Explicit save", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
      const id: string = created.body.story.id; ids.push(id);
      expect(created.body.story.savedAt).toBeNull();
      const lifetime = Date.parse(created.body.story.expiresAt) - Date.parse(created.body.story.createdAt);
      expect(lifetime).toBeLessThanOrEqual(86_400_000); expect(lifetime).toBeGreaterThan(86_399_000);
      await save(id, true, 1).expect(404);
      await save(id, true, 2).expect(404);
      await api(0).patch(`/api/v1/private-stories/${id}/saved`).set(auth(0)).send({ saved: "yes" }).expect(400);
      const saved = await save(id, true).expect(200);
      expect(saved.body.story.savedAt).toEqual(expect.any(String));
      expect((await save(id, true).expect(200)).body.story.savedAt).toBe(saved.body.story.savedAt);
      expect((await read("saved")).body.items.map((row: {id: string}) => row.id)).toContain(id);
      expect((await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(200)).body.story.savedAt).toBeNull();
      const unsaved = await make({ expiresAt: new Date(Date.now() - 1) });
      await db.privateStory.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1) } });
      await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
      await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
      await api(0).get(`/api/v1/private-stories/${unsaved.id}`).set(auth(0)).expect(404);
      await save(unsaved.id, true).expect(404);
      for (const [kind, who] of [["me", 0], ["feed", 1], ["saved", 1]] as const) {
        expect((await read(kind, who)).body.items.map((row: {id: string}) => row.id)).not.toEqual(expect.arrayContaining([id]));
      }
      expect(await app.get(PrivateStoriesService).canAccess(users[1]!.id, id)).toBe(false);
      expect(await app.get(PrivateStoriesService).canAccess(users[0]!.id, id)).toBe(true);
      await api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({ text: "Expired edit", audienceRule: "SELECTED", recipientIds: [] }).expect(404);
      await save(id, false).expect(200); await save(id, false).expect(200);
      expect((await read("saved")).body.items).toEqual([]);
      await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(404);
    });

    it("unsaves active Stories without expiring them and deletes both collections idempotently", async () => {
      const row = await make();
      await save(row.id, true).expect(200); await save(row.id, false).expect(200);
      expect((await read("me")).body.items.map((item: {id: string}) => item.id)).toContain(row.id);
      expect((await db.privateStory.findUniqueOrThrow({ where: { id: row.id } })).expiresAt).toEqual(row.expiresAt);
      await save(row.id, true).expect(200);
      await api(1).delete(`/api/v1/private-stories/${row.id}`).set(auth(1)).expect(404);
      await Promise.all([save(row.id, true), api(0).delete(`/api/v1/private-stories/${row.id}`).set(auth(0)).expect(200)]);
      await api(0).delete(`/api/v1/private-stories/${row.id}`).set(auth(0)).expect(200);
      await save(row.id, true).expect(404);
      const stored = await db.privateStory.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored.deletedAt).not.toBeNull(); expect(stored.savedAt).toBeNull();
      for (const kind of ["me", "saved"] as const) expect((await read(kind)).body.items.map((item: {id: string}) => item.id)).not.toContain(row.id);
      await api(0).get(`/api/v1/private-stories/${row.id}`).set(auth(0)).expect(404);
    });

    it("checks expiry after waiting for the save lock and serializes repeated saves", async () => {
      const row = await make(); const service = app.get(PrivateStoriesService);
      const saves = await Promise.all(Array.from({ length: 4 }, () => service.setSaved(users[0]!.id, row.id, true)));
      expect(new Set(saves.map(result => result.story.savedAt)).size).toBe(1);
      await service.setSaved(users[0]!.id, row.id, false);
      const lock = new Client({ connectionString: process.env.DATABASE_URL }); await lock.connect();
      try {
        await lock.query("BEGIN"); await lock.query('SELECT id FROM "PrivateStory" WHERE id=$1 FOR UPDATE', [row.id]);
        const pending = service.setSaved(users[0]!.id, row.id, true).then(() => null, error => error);
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await lock.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%PrivateStory%' AND pid<>pg_backend_pid()");
          if (result.rowCount) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        await lock.query(`UPDATE "PrivateStory" SET "expiresAt"=NOW()-interval '1 second' WHERE id=$1`, [row.id]);
        await lock.query("COMMIT");
        const error = await pending; expect(error?.getStatus()).toBe(404);
        expect((await db.privateStory.findUniqueOrThrow({ where: { id: row.id } })).savedAt).toBeNull();
      } finally { await lock.query("ROLLBACK"); await lock.end(); }
    });

    it("paginates saved Stories by original date with stable ties and removed cursor rows", async () => {
      const posted = new Date("2026-07-01T00:00:00Z");
      const rows = await Promise.all(Array.from({ length: 24 }, (_, index) => make({ createdAt: posted, expiresAt: new Date(posted.getTime() + 86_400_000), savedAt: new Date(Date.now() - index * 1000) })));
      const expected = rows.map(row => row.id).sort().reverse();
      const first = await read("saved"); expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.items.map((row: {id: string}) => row.id)).toEqual(expected.slice(0, 20));
      await save(expected[19]!, false).expect(200);
      const second = await read("saved", 0, first.body.nextCursor);
      expect(second.body.items.map((row: {id: string}) => row.id)).toEqual(expected.slice(20));
      expect(second.body.nextCursor).toBeNull();
      expect((await read("saved", 1)).body.items).toEqual([]);
      await api(0).get("/api/v1/private-stories/saved?cursor=invalid").set(auth(0)).expect(400);
    });

    it("preserves saved media during retention and purges unsaved or deleted expired records", async () => {
      const old = new Date(Date.now() - 40 * 86_400_000);
      const saved = await make({ expiresAt: old, savedAt: old });
      const unsaved = await make({ expiresAt: old });
      const deleted = await make({ expiresAt: old, savedAt: old, deletedAt: old });
      const recentDelete = await make({ expiresAt: old, deletedAt: new Date() });
      // Isolated DB plus fake storage: never sweep the shared development bucket.
      const fakeStorage = { deleteObject: jest.fn(), listObjects: jest.fn().mockResolvedValue({ objects: [] }) };
      const processor = new PrivateStoryCleanupProcessor({} as never, db, fakeStorage as never,
        { bucketMessageAttachments: "private-bucket" } as never, { log: jest.fn(), error: jest.fn() } as never);
      await Promise.all([processor.process(), save(saved.id, true).expect(200)]);
      expect(await db.privateStory.findUnique({ where: { id: saved.id } })).not.toBeNull();
      expect(await db.privateStory.findUnique({ where: { id: recentDelete.id } })).not.toBeNull();
      expect(await db.privateStory.findUnique({ where: { id: unsaved.id } })).toBeNull();
      expect(await db.privateStory.findUnique({ where: { id: deleted.id } })).toBeNull();
      await save(saved.id, false).expect(200); await processor.process();
      expect(await db.privateStory.findUnique({ where: { id: saved.id } })).toBeNull();
    });

    it("caps audience media URLs at expiry while retaining private owner archive access", async () => {
      await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
      await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
      const row = await make({ savedAt: new Date(), expiresAt: new Date(Date.now() + 5000), mediaBucket: "message-attachments",
        mediaObjectKey: `private-stories/${users[0]!.id}/${randomUUID()}.clean.png`, mediaMimeType: "image/png" });
      await db.privateStoryGrant.create({ data: { storyId: row.id, recipientId: users[1]!.id } });
      const recipient = await api(1).get(`/api/v1/private-stories/${row.id}`).set(auth(1)).expect(200);
      const ttl = Number(new URL(recipient.body.story.mediaUrl).searchParams.get("X-Amz-Expires"));
      expect(ttl).toBeGreaterThan(0); expect(ttl).toBeLessThanOrEqual(5);
      const owner = await api(0).get(`/api/v1/private-stories/${row.id}`).set(auth(0)).expect(200);
      expect(new URL(owner.body.story.mediaUrl).searchParams.get("X-Amz-Expires")).toBe("60");
      await api(0).delete(`/api/v1/private-stories/follows/followers/${users[1]!.id}`).set(auth(0)).expect(200);
      await api(1).get(`/api/v1/private-stories/${row.id}`).set(auth(1)).expect(404);
      await db.privateStory.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1) } });
      expect((await api(0).get(`/api/v1/private-stories/${row.id}`).set(auth(0)).expect(200)).body.story.mediaUrl).toBeTruthy();
      expect((await read("feed", 1)).body.items.map((item: {id: string}) => item.id)).not.toContain(row.id);
    });

    it("rechecks a new deletion after cleanup waits for its row lock", async () => {
      const row = await make({ expiresAt: new Date(Date.now() - 40 * 86_400_000),
        mediaBucket: "private-bucket", mediaObjectKey: `private-stories/${users[0]!.id}/${randomUUID()}.clean.png`,
        mediaMimeType: "image/png", mediaSizeBytes: 100 });
      const fakeStorage = { deleteObject: jest.fn(), listObjects: jest.fn().mockResolvedValue({ objects: [] }) };
      const processor = new PrivateStoryCleanupProcessor({} as never, db, fakeStorage as never,
        { bucketMessageAttachments: "private-bucket" } as never, { log: jest.fn(), error: jest.fn() } as never);
      const lock = new Client({ connectionString: process.env.DATABASE_URL }); await lock.connect();
      try {
        await lock.query("BEGIN"); await lock.query('SELECT id FROM "PrivateStory" WHERE id=$1 FOR UPDATE', [row.id]);
        const pending = processor.process();
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const result = await lock.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%PrivateStory%' AND pid<>pg_backend_pid()");
          if (result.rowCount) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
        await lock.query('UPDATE "PrivateStory" SET "deletedAt"=NOW() WHERE id=$1', [row.id]);
        await lock.query("COMMIT"); await pending;
        expect(await db.privateStory.findUnique({ where: { id: row.id } })).not.toBeNull();
        expect(fakeStorage.deleteObject).not.toHaveBeenCalledWith(expect.objectContaining({ objectKey: row.mediaObjectKey }));
      } finally { await lock.query("ROLLBACK"); await lock.end(); }
    });
  });

  it("measures bounded populated HTTP and signed-media reads without bypassing authorization", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "yariva-story-http-test-"));
    const photo = join(workspace, "photo.png"), video = join(workspace, "video.mp4");
    const mediaTools = app.get<ReturnType<typeof vibesConfig>>(vibesConfig.KEY);
    const ownerId = users[0]!.id, recipientId = users[1]!.id;
    const ids: string[] = [], keys: string[] = [];
    const samples: Array<{ kind: string; ms: number; bytes: number }> = [];
    const failures: unknown[] = [];
    const measure = async (kind: string, operation: () => Promise<number>) => {
      const start = performance.now();
      const bytes = await operation();
      samples.push({ kind, ms: performance.now() - start, bytes });
    };
    try {
      for (const recipient of [1, 2]) {
        await api(recipient).post(`/api/v1/private-stories/follows/${ownerId}`).set(auth(recipient)).expect(201);
        await api(0).post(`/api/v1/private-stories/follows/${users[recipient]!.id}/approve`).set(auth(0)).expect(201);
      }
      await runMediaTool(mediaTools.ffmpegPath, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-f", "lavfi", "-i", "testsrc2=size=640x480:rate=1", "-vf", "noise=alls=45:allf=t", "-frames:v", "1", photo], 30_000);
      await runMediaTool(mediaTools.ffmpegPath, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "5", "-c:v", "libx264", "-crf", "23", video], 30_000);
      const photoBytes = (await readFile(photo)).length, videoBytes = (await readFile(video)).length;
      const now = Date.now();
      const rows = Array.from({ length: 40 }, (_, index) => {
        const mimeType = index % 4 === 2 ? null : index % 4 === 1 ? "video/mp4" : "image/png";
        const id = randomUUID(); ids.push(id);
        const objectKey = mimeType ? `private-stories/${ownerId}/${randomUUID()}.clean.${mimeType === "image/png" ? "png" : "mp4"}` : null;
        if (objectKey) keys.push(objectKey);
        return { id, ownerId, text: `HTTP acceptance ${index}`, audienceRule: "SELECTED", moderationStatus: "APPROVED" as const,
          createdAt: new Date(now - index * 1000), expiresAt: new Date(now + 3_600_000),
          mediaBucket: mimeType ? "message-attachments" : null, mediaObjectKey: objectKey, mediaMimeType: mimeType,
          mediaSizeBytes: mimeType === "image/png" ? photoBytes : mimeType === "video/mp4" ? videoBytes : null };
      });
      for (const row of rows) if (row.mediaObjectKey && row.mediaMimeType) {
        await storage.putFile({ bucket: "message-attachments", objectKey: row.mediaObjectKey,
          sourcePath: row.mediaMimeType === "image/png" ? photo : video, mimeType: row.mediaMimeType });
      }
      await db.privateStory.createMany({ data: rows });
      await db.privateStoryGrant.createMany({ data: ids.map(storyId => ({ storyId, recipientId })) });
      const first = await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200);
      expect(first.body.items.map((item: { id: string }) => item.id)).toEqual(ids.slice(0, 20));
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const work: Array<() => Promise<void>> = Array.from({ length: 8 }, (_, index) => () => measure("feed", async () => {
        const response = await api(1).get("/api/v1/private-stories/feed").set(auth(1))
          .query(index % 2 ? { cursor: first.body.nextCursor } : {}).expect(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(ids.slice(index % 2 ? 20 : 0, index % 2 ? 40 : 20));
        return Buffer.byteLength(response.text);
      }));
      const mediaRows = ["image/png", "video/mp4"].flatMap(mime => rows.filter(row => row.mediaMimeType === mime).slice(0, 8));
      for (const row of mediaRows) work.push(async () => {
        let mediaUrl = "";
        await measure("detail", async () => {
          const response = await api(1).get(`/api/v1/private-stories/${row.id}`).set(auth(1)).expect(200);
          expect(response.headers["cache-control"]).toBe("private, no-store");
          mediaUrl = response.body.story.mediaUrl;
          expect(mediaUrl).toContain("X-Amz-Expires=60");
          return Buffer.byteLength(response.text);
        });
        await measure(row.mediaMimeType!, async () => {
          const response = await fetch(mediaUrl);
          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toBe("private, no-store");
          const bytes = (await response.arrayBuffer()).byteLength;
          expect(bytes).toBe(row.mediaSizeBytes);
          return bytes;
        });
      });
      let next = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < work.length) {
          const operation = work[next++]!;
          try { await operation(); } catch (error) { failures.push(error); }
        }
      }));
      const metrics = Object.fromEntries([...new Set(samples.map(sample => sample.kind))].map(kind => {
        const selected = samples.filter(sample => sample.kind === kind).sort((a, b) => a.ms - b.ms);
        const percentile = (fraction: number) => Number(selected[Math.ceil(selected.length * fraction) - 1]!.ms.toFixed(2));
        return [kind, { requests: selected.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: percentile(1),
          bytes: selected.reduce((sum, sample) => sum + sample.bytes, 0) }];
      }));
      console.info("PRIVATE_STORY_HTTP_SAMPLE", JSON.stringify({ stories: 40, photos: 20, videos: 10, text: 10,
        photoBytes, videoBytes, concurrency: 4, errors: failures.length, metrics }));
      expect(failures).toEqual([]);
      expect(samples).toHaveLength(40);
      // An approved connection alone never grants access; revocation also invalidates fresh reads.
      await api(2).get(`/api/v1/private-stories/${ids[0]}`).set(auth(2)).expect(404);
      expect((await api(2).get("/api/v1/private-stories/feed").set(auth(2)).expect(200)).body.items).toEqual([]);
      await api(0).delete(`/api/v1/private-stories/follows/followers/${recipientId}`).set(auth(0)).expect(200);
      await api(1).get(`/api/v1/private-stories/${ids[0]}`).set(auth(1)).expect(404);
      expect((await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200)).body.items).toEqual([]);
    } finally {
      await db.privateStory.deleteMany({ where: { id: { in: ids }, ownerId } });
      for (const objectKey of keys) await storage.deleteObject({ bucket: "message-attachments", objectKey });
      await db.privateFollow.deleteMany({ where: { ownerId, requesterId: { in: [recipientId, users[2]!.id] } } });
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("commits recoverable Story notices with publication even when the queue is unavailable", async () => {
    for (const recipient of [1, 2]) {
      await api(recipient).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(recipient)).expect(201);
      await api(0).post(`/api/v1/private-stories/follows/${users[recipient]!.id}/approve`).set(auth(0)).expect(201);
    }
    const queue = jest.spyOn(app.get(BullmqProducer), "enqueue").mockRejectedValue(new Error("queue unavailable"));
    try {
      const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({
        text: "A durable private moment", audienceRule: "SELECTED", recipientIds: [users[1]!.id],
      }).expect(201);
      const storyId = created.body.story.id;
      const where = { dedupeKey: { startsWith: `private-story:${storyId}:` } };
      const notices = await db.notification.findMany({ where });
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({ userId: users[1]!.id, actorUserId: null, status: "PENDING",
        title: "New update", body: "A private Story is available in Yariva.", data: { route: "private-story", storyId } });
      expect(JSON.stringify(notices)).not.toContain("A durable private moment");
      // Prioritize only this test's pending row in the bounded recovery scan.
      await db.notification.updateMany({ where, data: { createdAt: new Date(0) } });
      queue.mockResolvedValue(undefined);
      await app.get(CreateNotificationService).recoverPending();
      expect(queue).toHaveBeenCalledWith("notification.dispatch", { notificationId: notices[0]!.id },
        { jobId: `notification.dispatch:${notices[0]!.id}`, retryFinished: true });
      await app.get(NotificationDispatchService).execute({ type: "PRIVATE_STORY_SHARED", storyId });
      expect(await db.notification.count({ where })).toBe(1);
      await api(0).delete(`/api/v1/private-stories/follows/followers/${users[1]!.id}`).set(auth(0)).expect(200);
      await app.get(NotificationDispatchService).execute({ notificationId: notices[0]!.id });
      expect((await db.notification.findUniqueOrThrow({ where: { id: notices[0]!.id } })).status).toBe("CANCELED");
      expect((await api(1).get("/api/v1/notifications").set(auth(1)).expect(200)).body.items
        .map((notice: { id: string }) => notice.id)).not.toContain(notices[0]!.id);
    } finally {
      queue.mockRestore();
      await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: { in: [users[1]!.id, users[2]!.id] } } });
      await db.privateStory.updateMany({ where: { ownerId: users[0]!.id, text: "A durable private moment" }, data: { deletedAt: new Date() } });
    }
  });

  it("commits one notice with concurrent moderation approval despite queue failure", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const story = await db.privateStory.create({ data: { ownerId: users[0]!.id, text: "Moderation retry",
      audienceRule: "SELECTED", moderationStatus: "PENDING", expiresAt: new Date(Date.now() + 3_600_000),
      grants: { create: { recipientId: users[1]!.id } } } });
    const queue = jest.spyOn(app.get(BullmqProducer), "enqueue").mockRejectedValue(new Error("queue unavailable"));
    try {
      const service = app.get(PrivateStoriesService);
      const input = { decision: "APPROVED" as const, expectedUpdatedAt: story.updatedAt.toISOString() };
      const applied = await Promise.all([service.review(story.id, input, { actorUserId: users[3]!.id }),
        service.review(story.id, input, { actorUserId: users[3]!.id })]);
      expect(applied.filter(Boolean)).toHaveLength(1);
      expect(await db.notification.count({ where: { dedupeKey: `private-story:${story.id}:${users[1]!.id}` } })).toBe(1);
      expect(await db.auditLog.count({ where: { entityId: story.id, action: "private-story.moderation.approve" } })).toBe(1);
    } finally {
      queue.mockRestore();
      await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: users[1]!.id } });
      await db.privateStory.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
    }
  });

  it("rolls back Story publication and every notice if intent persistence fails", async () => {
    for (const recipient of [1, 2]) {
      await api(recipient).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(recipient)).expect(201);
      await api(0).post(`/api/v1/private-stories/follows/${users[recipient]!.id}/approve`).set(auth(0)).expect(201);
    }
    const intent = app.get(NotificationIntentService);
    const persist = jest.spyOn(intent, "persist").mockImplementationOnce(intent.persist.bind(intent))
      .mockRejectedValueOnce(new Error("notice persistence unavailable"));
    const dispatch = jest.spyOn(intent, "dispatchPersisted");
    const where = { userId: { in: [users[1]!.id, users[2]!.id] } };
    const before = await db.notification.count({ where });
    try {
      await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Atomic failure",
        audienceRule: "SELECTED", recipientIds: [users[1]!.id, users[2]!.id] }).expect(500);
      expect(await db.privateStory.count({ where: { ownerId: users[0]!.id, text: "Atomic failure" } })).toBe(0);
      expect(await db.notification.count({ where })).toBe(before);
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      persist.mockRestore(); dispatch.mockRestore();
      await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: { in: [users[1]!.id, users[2]!.id] } } });
    }
  });

  it("rolls back moderation and audit with failed notice persistence, then permits a retry", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const story = await db.privateStory.create({ data: { ownerId: users[0]!.id, text: "Review rollback",
      audienceRule: "SELECTED", moderationStatus: "PENDING", expiresAt: new Date(Date.now() + 3_600_000),
      grants: { create: { recipientId: users[1]!.id } } } });
    const failure = jest.spyOn(app.get(NotificationIntentService), "persist").mockRejectedValueOnce(new Error("notice persistence unavailable"));
    const service = app.get(PrivateStoriesService);
    const input = { decision: "APPROVED" as const, expectedUpdatedAt: story.updatedAt.toISOString() };
    try {
      await expect(service.review(story.id, input, { actorUserId: users[3]!.id })).rejects.toThrow("notice persistence unavailable");
      expect((await db.privateStory.findUniqueOrThrow({ where: { id: story.id } })).moderationStatus).toBe("PENDING");
      expect(await db.auditLog.count({ where: { entityId: story.id, action: "private-story.moderation.approve" } })).toBe(0);
      expect(await db.notification.count({ where: { dedupeKey: `private-story:${story.id}:${users[1]!.id}` } })).toBe(0);
      failure.mockRestore();
      await expect(service.review(story.id, input, { actorUserId: users[3]!.id })).resolves.toBe(true);
      expect(await db.notification.count({ where: { dedupeKey: `private-story:${story.id}:${users[1]!.id}` } })).toBe(1);
    } finally {
      failure.mockRestore();
      await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: users[1]!.id } });
      await db.privateStory.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
    }
  });

  it("does not publish a committed notice when the follow is revoked before dispatch", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const service = app.get(PrivateStoriesService);
    const canAccess = service.canAccess.bind(service);
    const policy = jest.spyOn(service, "canAccess").mockImplementation(async (recipientId, storyId, transaction) => {
      if (!transaction) await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: recipientId } });
      return canAccess(recipientId, storyId, transaction);
    });
    const dispatch = jest.spyOn(app.get(NotificationIntentService), "dispatchPersisted");
    try {
      const result = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Revoked after commit",
        audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(201);
      const storyId = result.body.story.id;
      const notice = await db.notification.findUniqueOrThrow({ where: { dedupeKey: `private-story:${storyId}:${users[1]!.id}` } });
      expect(notice.status).toBe("PENDING");
      expect(dispatch).not.toHaveBeenCalled();
      await api(1).get(`/api/v1/private-stories/${storyId}`).set(auth(1)).expect(404);
      expect((await api(1).get("/api/v1/notifications").set(auth(1)).expect(200)).body.items
        .map((item: { id: string }) => item.id)).not.toContain(notice.id);
      await app.get(NotificationDispatchService).execute({ notificationId: notice.id });
      expect((await db.notification.findUniqueOrThrow({ where: { id: notice.id } })).status).toBe("CANCELED");
    } finally {
      policy.mockRestore(); dispatch.mockRestore();
      await db.privateFollow.deleteMany({ where: { ownerId: users[0]!.id, requesterId: users[1]!.id } });
      await db.privateStory.updateMany({ where: { ownerId: users[0]!.id, text: "Revoked after commit" }, data: { deletedAt: new Date() } });
    }
  });

  it("persists the bounded 100-recipient audience with the default transaction timeout", async () => {
    const recipients = Array.from({ length: 100 }, () => randomUUID());
    const queue = jest.spyOn(app.get(BullmqProducer), "enqueue").mockRejectedValue(new Error("queue unavailable"));
    let storyId: string | undefined;
    try {
      await db.user.createMany({ data: recipients.map(id => ({ id, passwordHash: "disabled-test-account" })) });
      await db.privateFollow.createMany({ data: recipients.map(requesterId => ({ requesterId, ownerId: users[0]!.id, status: "APPROVED" })) });
      await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { allowlistUserIds: [...users.map(user => user.id), ...recipients] } });
      const start = performance.now();
      const result = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Bounded publication",
        audienceRule: "SELECTED", recipientIds: recipients }).expect(201);
      const durationMs = Number((performance.now() - start).toFixed(2));
      storyId = result.body.story.id;
      expect(result.body.eligibleCount).toBe(100);
      expect(await db.privateStoryGrant.count({ where: { storyId } })).toBe(100);
      const notices = await db.notification.findMany({ where: { userId: { in: recipients } } });
      expect(notices).toHaveLength(100);
      expect(new Set(notices.map(notice => notice.userId))).toEqual(new Set(recipients));
      expect(notices.every(notice => notice.status === "PENDING" && notice.actorUserId === null
        && notice.dedupeKey === `private-story:${storyId}:${notice.userId}`)).toBe(true);
      console.info("Bounded Story publication sample", { recipients: 100, durationMs, queueAvailable: false });
    } finally {
      queue.mockRestore();
      await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { allowlistUserIds: users.map(user => user.id) } });
      await db.notification.deleteMany({ where: { userId: { in: recipients } } });
      await db.privateStoryGrant.deleteMany({ where: { recipientId: { in: recipients } } });
      if (storyId) await db.privateStory.delete({ where: { id: storyId } });
      await db.privateFollow.deleteMany({ where: { requesterId: { in: recipients } } });
      await db.user.deleteMany({ where: { id: { in: recipients } } });
    }
  });

  it("bounds populated-feed queries and freshly authorizes every Story in the batch", async () => {
    const [ownerId, matchOwnerId, blockedOwnerId, viewerId] = Array.from({ length: 4 }, () => randomUUID()) as [string, string, string, string];
    const fixtureUsers = [ownerId, matchOwnerId, blockedOwnerId, viewerId];
    const ids = Array.from({ length: 23 }, () => randomUUID());
    const now = new Date();
    const service = app.get(PrivateStoriesService);
    const pair = [viewerId, matchOwnerId].sort();
    const read = async (cursor?: string) => {
      // Count actual PostgreSQL driver queries, without logging SQL or parameters.
      const queries = jest.spyOn(Client.prototype, "query");
      const start = performance.now();
      try {
        const page = await service.feed(viewerId, cursor);
        return { ...page, queries: queries.mock.calls.length, durationMs: Number((performance.now() - start).toFixed(2)) };
      } finally { queries.mockRestore(); }
    };
    try {
      await db.user.createMany({ data: fixtureUsers.map(id => ({ id, passwordHash: "disabled-test-account" })) });
      await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { allowlistUserIds: [...users.map(user => user.id), ...fixtureUsers] } });
      await db.privateFollow.createMany({ data: [ownerId, blockedOwnerId].map(ownerId => ({ requesterId: viewerId, ownerId, status: "APPROVED" })) });
      await db.match.create({ data: { userLowId: pair[0]!, userHighId: pair[1]! } });
      await db.block.create({ data: { blockerId: viewerId, blockedId: blockedOwnerId } });
      await db.privateStory.create({ data: { id: ids[0]!, ownerId, text: "Populated feed fixture",
        audienceRule: "SELECTED", moderationStatus: "APPROVED", expiresAt: new Date(now.getTime() + 3_600_000),
        createdAt: now, grants: { create: { recipientId: viewerId } } } });
      const single = await read();
      expect(single.items.map(story => story.id)).toEqual([ids[0]]);
      await db.privateStory.createMany({ data: ids.slice(1).map((id, index) => ({ id,
        ownerId: index === 19 ? matchOwnerId : index === 20 ? blockedOwnerId : ownerId,
        text: "Populated feed fixture", audienceRule: "SELECTED", moderationStatus: "APPROVED",
        expiresAt: new Date(now.getTime() + 3_600_000), createdAt: new Date(now.getTime() - index - 1),
      })) });
      // One approved connection's Story deliberately has no selected-recipient grant.
      await db.privateStoryGrant.createMany({ data: ids.slice(1, -1).map(storyId => ({ storyId, recipientId: viewerId })) });
      const first = await read();
      console.info("Populated Story feed service sample", { single: { queries: single.queries, durationMs: single.durationMs },
        full: { items: first.items.length, queries: first.queries, durationMs: first.durationMs } });
      expect(first.items).toHaveLength(20);
      expect(first.queries).toBeGreaterThan(0);
      expect(first.queries).toBeLessThanOrEqual(single.queries + 2);
      expect(first.queries).toBeLessThanOrEqual(10);
      expect(first.nextCursor).toEqual(expect.any(String));
      const second = await read(first.nextCursor!);
      const seen = [...first.items, ...second.items].map(story => story.id);
      expect(new Set(seen)).toEqual(new Set(ids.slice(0, 21)));
      expect(seen).toHaveLength(21);
      expect(second.nextCursor).toBeNull();
      // Every later read must query current relationships and consent again.
      await db.privateFollow.update({ where: { requesterId_ownerId: { requesterId: viewerId, ownerId } }, data: { status: "PENDING" } });
      expect((await read()).items.map(story => story.id)).toEqual([ids[20]]);
      expect(await service.canAccess(viewerId, ids[0]!)).toBe(false);
      await expect(service.detail(viewerId, ids[0]!)).rejects.toMatchObject({ status: 404 });
      await db.privateFollow.update({ where: { requesterId_ownerId: { requesterId: viewerId, ownerId } }, data: { status: "APPROVED" } });
      await db.privateStory.updateMany({ where: { id: { in: ids.slice(0, 21) } }, data: { communityFilter: "GAY" } });
      await db.privateCommunityPreference.create({ data: { userId: viewerId, optedInCommunities: ["GAY"] } });
      expect((await read()).items).toHaveLength(20);
      await db.privateCommunityPreference.update({ where: { userId: viewerId }, data: { optedInCommunities: [] } });
      expect((await read()).items).toEqual([]);
      expect(await service.canAccess(viewerId, ids[20]!)).toBe(false);
      await db.privateCommunityPreference.update({ where: { userId: viewerId }, data: { optedInCommunities: ["GAY"] } });
      await db.user.update({ where: { id: ownerId }, data: { isShadowBanned: true } });
      expect((await read()).items.map(story => story.id)).toEqual([ids[20]]);
      await db.user.update({ where: { id: viewerId }, data: { isShadowBanned: true } });
      expect((await read()).items).toEqual([]);
    } finally {
      await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { allowlistUserIds: users.map(user => user.id) } });
      await db.privateStory.deleteMany({ where: { id: { in: ids } } });
      await db.privateCommunityPreference.deleteMany({ where: { userId: viewerId } });
      await db.privateFollow.deleteMany({ where: { requesterId: viewerId } });
      await db.block.deleteMany({ where: { blockerId: viewerId } });
      await db.match.deleteMany({ where: { userLowId: pair[0]!, userHighId: pair[1]! } });
      await db.user.deleteMany({ where: { id: { in: fixtureUsers } } });
    }
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
    // Identity and connection interests must never substitute for explicit consent.
    const discoveryBefore = await db.userDiscoveryPreference.findUnique({ where: { userId: users[1]!.id } });
    const genderBefore = await db.userProfile.findUnique({ where: { userId: users[1]!.id }, select: { gender: true } });
    await api(1).patch("/api/v1/private-stories/community").set(auth(1)).send({ ...community, optedInCommunities: [] }).expect(200);
    await api(1).get(`/api/v1/private-stories/${second.body.story.id}`).set(auth(1)).expect(404);
    const preview = await api(0).post("/api/v1/private-stories/audience-preview").set(auth(0)).send({ audienceRule: "ALL_APPROVED", communityFilter: "GAY" }).expect(201);
    expect(preview.body.eligibleCount).toBe(0);
    expect(await db.userDiscoveryPreference.findUnique({ where: { userId: users[1]!.id } })).toEqual(discoveryBefore);
    expect(await db.userProfile.findUnique({ where: { userId: users[1]!.id }, select: { gender: true } })).toEqual(genderBefore);
    const cleared = { identifyAs: [], connectWith: [], optedInCommunities: [], selfDescription: null };
    await api(1).patch("/api/v1/private-stories/community").set(auth(1)).send(cleared).expect(200);
    expect((await api(1).get("/api/v1/private-stories/community").set(auth(1)).expect(200)).body).toMatchObject(cleared);
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

  it("serializes concurrent audience edits without leaving a union of grants", async () => {
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({
      text: "Concurrent audience", audienceRule: "SELECTED", recipientIds: [users[1]!.id],
    }).expect(201);
    const id = created.body.story.id;
    const edits = await Promise.all([
      api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({
        audienceRule: "SELECTED", recipientIds: [users[1]!.id, users[2]!.id], confirmAudienceExpansion: true,
      }),
      api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({
        audienceRule: "SELECTED", recipientIds: [users[1]!.id, users[3]!.id], confirmAudienceExpansion: true,
      }),
    ]);
    expect(edits.some(edit => edit.status === 200)).toBe(true);
    expect(edits.every(edit => [200, 409].includes(edit.status))).toBe(true);
    const grantIds = (await db.privateStoryGrant.findMany({ where: { storyId: id }, select: { recipientId: true } })).map(item => item.recipientId).sort();
    expect([users[1]!.id, users[2]!.id, users[3]!.id]).toEqual(expect.arrayContaining(grantIds));
    expect(grantIds).toHaveLength(2);
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
    expect(followers.items).toEqual(expect.arrayContaining([expect.objectContaining({ userId: users[1]!.id, displayName: "Story test 1" })]));
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
    // A valid PNG with a Location tEXt chunk. The stored image must be decoded
    // and rewritten, rather than exposing the location-bearing upload.
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAFnRFWHRMb2NhdGlvbgAxNy4xMjMsNzguNDU2lJTQZgAAAAxJREFUeJxj+M/AAAADAQEAyf6S7wAAAABJRU5ErkJggg==", "base64");
    expect(bytes.includes(Buffer.from("17.123,78.456"))).toBe(true);
    const upload = (await api(0).post("/api/v1/private-stories/media/upload").set(auth(0)).send({ mimeType: "image/png", sizeBytes: bytes.length }).expect(201)).body;
    let processedKey: string | undefined;
    try {
      expect((await fetch(upload.uploadUrl, { method: "PUT", headers: upload.uploadHeaders, body: bytes })).ok).toBe(true);
      const created = (await api(0).post("/api/v1/private-stories").set(auth(0)).send({ audienceRule: "SELECTED", recipientIds: [users[1]!.id], media: { objectKey: upload.objectKey, uploadToken: upload.uploadToken, mimeType: "image/png", sizeBytes: bytes.length } }).expect(201)).body;
      const id = created.story.id;
      const stored = await db.privateStory.findUniqueOrThrow({ where: { id } });
      processedKey = stored.mediaObjectKey ?? undefined;
      expect(processedKey).toMatch(new RegExp(`^private-stories/${users[0]!.id}/[0-9a-f-]+\\.clean\\.png$`));
      expect(processedKey).not.toBe(upload.objectKey);
      expect((await storage.headObject({ bucket: "message-attachments", objectKey: processedKey! })).metadata).toEqual({});
      await expect(storage.headObject({ bucket: "message-attachments", objectKey: upload.objectKey })).rejects.toThrow();
      expect(created.story.moderationStatus).toBe("PENDING");
      expect((await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200)).body.story.mediaUrl).toContain("X-Amz-Expires=60");
      await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
      expect((await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(id);
      await app.get(NotificationDispatchService).execute({ type: "PRIVATE_STORY_SHARED", storyId: id });
      expect(await db.notification.count({ where: { dedupeKey: `private-story:${id}:${users[1]!.id}` } })).toBe(0);
      await api(0).get("/api/v1/admin/moderation/private-stories").set(auth(0)).expect(403);
      await api(0).get(`/api/v1/admin/moderation/private-stories/${id}`).set(auth(0)).expect(403);
      await api(0).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(0)).send({ decision: "APPROVED" }).expect(403);
      await db.user.update({ where: { id: users[3]!.id }, data: { role: "ADMIN" } });
      try {
        const queue = await api(3).get("/api/v1/admin/moderation/private-stories").set(auth(3)).expect(200);
        expect(queue.body.items.map((item: { id: string }) => item.id)).toContain(id);
        expect(queue.headers["cache-control"]).toBe("private, no-store");
        const review = await api(3).get(`/api/v1/admin/moderation/private-stories/${id}`).set(auth(3)).expect(200);
        expect(review.body.story.mediaUrl).toContain("X-Amz-Expires=60");
        expect(JSON.stringify(review.body)).not.toMatch(/recipientIds|communityFilter|identifyAs/);
        expect(await db.auditLog.count({ where: { entityId: id, action: "private-story.moderation.view", actorUserId: users[3]!.id } })).toBe(1);
        await api(3).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(3)).send({ decision: "APPROVED" }).expect(400);
        const decisions = await Promise.all([1, 2].map(() => api(3).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(3)).send({ decision: "APPROVED", expectedUpdatedAt: review.body.story.updatedAt }).expect(201)));
        expect(decisions.map(result => result.body.applied).sort()).toEqual([false, true]);
        expect(await db.auditLog.count({ where: { entityId: id, action: "private-story.moderation.approve" } })).toBe(1);
      } finally {
        await db.user.update({ where: { id: users[3]!.id }, data: { role: "USER" } });
      }
      const recipient = (await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(200)).body.story;
      expect(recipient.mediaUrl).toContain("X-Amz-Expires=60");
      const image = await fetch(recipient.mediaUrl);
      expect(image.ok).toBe(true);
      const cleanBytes = Buffer.from(await image.arrayBuffer());
      expect(cleanBytes.includes(Buffer.from("17.123,78.456"))).toBe(false);
      expect(cleanBytes.includes(Buffer.from("Location"))).toBe(false);
      const preview = (await api(1).get("/api/v1/private-stories/feed").set(auth(1)).expect(200)).body.items.find((item: { id: string }) => item.id === id);
      expect(preview.previewUrl).toContain("X-Amz-Expires=10");
      expect((await api(3).get("/api/v1/private-stories/feed").set(auth(3)).expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(id);
      const edited = await api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({ text: "A changed caption", audienceRule: "SELECTED", recipientIds: [users[1]!.id] }).expect(200);
      expect(edited.body.story.moderationStatus).toBe("PENDING");
      await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
      await db.user.update({ where: { id: users[3]!.id }, data: { role: "ADMIN" } });
      try {
        expect((await api(3).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(3)).send({ decision: "APPROVED", expectedUpdatedAt: stored.updatedAt.toISOString() }).expect(201)).body.applied).toBe(false);
        const review = await api(3).get(`/api/v1/admin/moderation/private-stories/${id}`).set(auth(3)).expect(200);
        expect((await api(3).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(3)).send({ decision: "APPROVED", expectedUpdatedAt: review.body.story.updatedAt }).expect(201)).body.applied).toBe(true);
      } finally {
        await db.user.update({ where: { id: users[3]!.id }, data: { role: "USER" } });
      }
      await api(0).delete(`/api/v1/private-stories/follows/followers/${users[1]!.id}`).set(auth(0)).expect(200);
      await api(1).get(`/api/v1/private-stories/${id}`).set(auth(1)).expect(404);
      // S3 presigned URLs cannot be revoked individually: this read may work
      // until the issued 60-second URL expires, as the UI/ADR must disclose.
      expect((await fetch(recipient.mediaUrl)).ok).toBe(true);
      await api(0).delete(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
    } finally {
      await storage.deleteObject({ bucket: "message-attachments", objectKey: upload.objectKey });
      if (processedKey) await storage.deleteObject({ bucket: "message-attachments", objectKey: processedKey });
    }
  });

  it.each([1, 31])("strips video location metadata and enforces the duration limit (%i seconds)", async duration => {
    const workspace = await mkdtemp(join(tmpdir(), "yariva-story-video-test-"));
    const source = join(workspace, "source.mov"), clean = join(workspace, "clean.mp4");
    const tools = app.get<ReturnType<typeof vibesConfig>>(vibesConfig.KEY);
    let uploadKey: string | undefined, processedKey: string | undefined;
    try {
      await runMediaTool(tools.ffmpegPath, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=white:s=32x32:r=1", "-t", String(duration), "-c:v", "libx264", "-metadata", "location=+17.123+078.456/", source], 30_000);
      expect(JSON.stringify(await probeMedia(tools.ffprobePath, source))).toContain("17.123");
      const bytes = await readFile(source);
      const upload = (await api(0).post("/api/v1/private-stories/media/upload").set(auth(0)).send({ mimeType: "video/quicktime", sizeBytes: bytes.length }).expect(201)).body;
      uploadKey = upload.objectKey;
      expect((await fetch(upload.uploadUrl, { method: "PUT", headers: upload.uploadHeaders, body: bytes })).ok).toBe(true);
      const result = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ audienceRule: "SELECTED", recipientIds: [users[2]!.id], media: { objectKey: upload.objectKey, uploadToken: upload.uploadToken, mimeType: "video/quicktime", sizeBytes: bytes.length } }).expect(duration > 30 ? 400 : 201);
      if (duration > 30) {
        expect(JSON.stringify(result.body)).toContain("30 seconds");
        return;
      }
      expect(result.body.story).toMatchObject({ moderationStatus: "PENDING", mediaMimeType: "video/mp4" });
      processedKey = (await db.privateStory.findUniqueOrThrow({ where: { id: result.body.story.id } })).mediaObjectKey!;
      expect(processedKey).toMatch(/\.clean\.mp4$/);
      const detail = (await api(0).get(`/api/v1/private-stories/${result.body.story.id}`).set(auth(0)).expect(200)).body;
      await writeFile(clean, Buffer.from(await (await fetch(detail.story.mediaUrl)).arrayBuffer()));
      expect(JSON.stringify(await probeMedia(tools.ffprobePath, clean))).not.toContain("17.123");
      await api(2).get(`/api/v1/private-stories/${result.body.story.id}`).set(auth(2)).expect(404);
      await expect(storage.headObject({ bucket: "message-attachments", objectKey: uploadKey! })).rejects.toThrow();
      await api(0).delete(`/api/v1/private-stories/${result.body.story.id}`).set(auth(0)).expect(200);
    } finally {
      if (uploadKey) await storage.deleteObject({ bucket: "message-attachments", objectKey: uploadKey });
      if (processedKey) await storage.deleteObject({ bucket: "message-attachments", objectKey: processedKey });
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("uses the same fail-closed policy for the owner's list and detail", async () => {
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Owner policy", audienceRule: "SELECTED", recipientIds: [users[2]!.id] }).expect(201);
    const id = created.body.story.id;
    const ownIds = async () => (await api(0).get("/api/v1/private-stories/me").set(auth(0)).expect(200)).body.items.map((item: { id: string }) => item.id);
    expect(await ownIds()).toContain(id);
    await db.privateStory.update({ where: { id }, data: { mediaBucket: "message-attachments", mediaObjectKey: `private-stories/${users[0]!.id}/${randomUUID()}.png`, mediaMimeType: "image/png" } });
    expect(await ownIds()).not.toContain(id);
    await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(404);
    await db.privateStory.update({ where: { id }, data: { mediaBucket: null, mediaObjectKey: null, mediaMimeType: null, expiresAt: new Date(Date.now() - 1000) } });
    expect(await ownIds()).not.toContain(id);
    await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(404);
    await api(0).delete(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
  });

  it("paginates owned Stories without leaking filtered rows or skipping equal timestamps", async () => {
    const ownerId = users[3]!.id;
    const ids: string[] = Array.from({ length: 25 }, () => randomUUID()).sort().reverse();
    const createdAt = new Date();
    const read = (cursor?: string) => api(3).get("/api/v1/private-stories/me")
      .query(cursor ? { cursor } : {}).set(auth(3)).expect(200);
    try {
      await db.privateStory.createMany({ data: ids.map((id, index) => ({ id, ownerId,
        text: `Owner page ${index}`, audienceRule: "SELECTED", createdAt,
        expiresAt: new Date(createdAt.getTime() + 3_600_000), moderationStatus: index === 1 ? "REJECTED" : "APPROVED",
        ...(index === 0 ? { mediaBucket: "message-attachments", mediaObjectKey: `private-stories/${ownerId}/${randomUUID()}.png`, mediaMimeType: "image/png" } : {}),
        ...(index === 23 ? { deletedAt: createdAt } : {}),
        ...(index === 24 ? { expiresAt: new Date(createdAt.getTime() - 1) } : {}),
      })) });
      const first = await read();
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.nextCursor).toEqual(expect.any(String));
      expect(first.body.items.map((story: { id: string }) => story.id)).toEqual(ids.slice(1, 20));
      expect(first.body.items[0]).toMatchObject({ moderationStatus: "REJECTED", previewUrl: null });
      await db.privateStory.updateMany({ where: { id: { in: ids.slice(1, 20) } }, data: {
        mediaBucket: "message-attachments", mediaObjectKey: `private-stories/${ownerId}/unprocessed.png`, mediaMimeType: "image/png",
      } });
      const filtered = await read();
      expect(filtered.body.items).toEqual([]);
      expect(filtered.body.nextCursor).toBe(first.body.nextCursor);
      const afterFiltered = await read(filtered.body.nextCursor);
      expect(afterFiltered.body.items.map((story: { id: string }) => story.id)).toEqual(ids.slice(20, 23));
      // A deleted cursor row must still allow progress; a newer insertion must
      // not shift the boundary or duplicate Stories from the first page.
      await api(3).delete(`/api/v1/private-stories/${ids[19]}`).set(auth(3)).expect(200);
      await api(3).delete(`/api/v1/private-stories/${ids[20]}`).set(auth(3)).expect(200);
      const newer = await db.privateStory.create({ data: { ownerId, text: "Newer than cursor", audienceRule: "SELECTED",
        moderationStatus: "APPROVED", createdAt: new Date(createdAt.getTime() + 1), expiresAt: new Date(createdAt.getTime() + 3_600_000) } });
      ids.push(newer.id);
      const second = await read(first.body.nextCursor);
      expect(second.body.items.map((story: { id: string }) => story.id)).toEqual(ids.slice(21, 23));
      expect(second.body.nextCursor).toBeNull();
      const seen = [...first.body.items, ...second.body.items].map((story: { id: string }) => story.id);
      expect(new Set(seen).size).toBe(seen.length);
      const outsider = await api(2).get("/api/v1/private-stories/me").query({ cursor: first.body.nextCursor }).set(auth(2)).expect(200);
      expect(outsider.body.items.every((story: { ownerId: string }) => story.ownerId === users[2]!.id)).toBe(true);
      await api(3).get("/api/v1/private-stories/me?cursor=invalid").set(auth(3)).expect(400);
      await db.user.update({ where: { id: ownerId }, data: { isShadowBanned: true } });
      expect(await app.get(PrivateStoriesService).mine(ownerId)).toEqual({ items: [], nextCursor: null });
    } finally {
      await db.user.update({ where: { id: ownerId }, data: { isShadowBanned: false } });
      await db.privateStory.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("keeps a cursor when a visible page fills before the fetched batch ends", async () => {
    await api(1).post(`/api/v1/private-stories/follows/${users[0]!.id}`).set(auth(1)).expect(201);
    await api(0).post(`/api/v1/private-stories/follows/${users[1]!.id}/approve`).set(auth(0)).expect(201);
    const ids: string[] = [];
    for (let index = 0; index < 21; index++) {
      // Seed pagination volume directly so the create-route rate limit stays in force.
      const created = await db.privateStory.create({ data: { ownerId: users[0]!.id, text: `Page ${index}`,
        audienceRule: "SELECTED", moderationStatus: "APPROVED", expiresAt: new Date(Date.now() + 3_600_000),
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
        .toEqual(expect.arrayContaining([expect.objectContaining({ userId: users[3]!.id, displayName: "Story test 3" })]));
      expect((await api(3).get("/api/v1/private-stories/follows/following").set(auth(3)).expect(200)).body.items)
        .toEqual(expect.arrayContaining([expect.objectContaining({ userId: users[0]!.id, displayName: "Story test 0" })]));
      await api(3).delete(`/api/v1/private-stories/follows/requested/${users[0]!.id}`).set(auth(3)).expect(200);
    } finally {
      await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { enabled: true } });
    }
  });

  it("deduplicates generic Story notices and hides them from outsiders", async () => {
    const ownerId = users[0]!.id, recipientId = users[2]!.id;
    await db.privateFollow.upsert({ where: { requesterId_ownerId: { requesterId: recipientId, ownerId } },
      create: { requesterId: recipientId, ownerId, status: "APPROVED" }, update: { status: "APPROVED" } });
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({
      text: "Never include this caption in a notification", audienceRule: "SELECTED", recipientIds: [recipientId],
    }).expect(201);
    const storyId = created.body.story.id;
    const dispatcher = app.get(NotificationDispatchService);
    await Promise.all([1, 2].map(() => dispatcher.execute({ type: "PRIVATE_STORY_SHARED", storyId })));
    const rows = await db.notification.findMany({ where: { userId: recipientId, dedupeKey: `private-story:${storyId}:${recipientId}` } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorUserId: null, title: "New update", body: "A private Story is available in Yariva.",
      data: { route: "private-story", storyId } });
    const listed = await api(2).get("/api/v1/notifications").set(auth(2)).expect(200);
    expect(listed.headers["cache-control"]).toBe("private, no-store");
    expect(listed.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: rows[0]!.id, actor: null })]));
    await api(3).post(`/api/v1/notifications/${rows[0]!.id}/read`).set(auth(3)).expect(404);
    const read = await api(2).post(`/api/v1/notifications/${rows[0]!.id}/read`).set(auth(2)).expect(200);
    expect(read.headers["cache-control"]).toBe("private, no-store");
  });

  it("takes down a reported Story without allowing edits or approval to restore it", async () => {
    const ownerId = users[0]!.id, recipientId = users[2]!.id;
    await db.privateFollow.upsert({ where: { requesterId_ownerId: { requesterId: recipientId, ownerId } },
      create: { requesterId: recipientId, ownerId, status: "APPROVED" }, update: { status: "APPROVED" } });
    const created = await api(0).post("/api/v1/private-stories").set(auth(0)).send({ text: "Reported text", audienceRule: "SELECTED", recipientIds: [recipientId] }).expect(201);
    const id = created.body.story.id;
    const dispatcher = app.get(NotificationDispatchService);
    await dispatcher.execute({ type: "PRIVATE_STORY_SHARED", storyId: id });
    const notice = await db.notification.findFirstOrThrow({ where: { dedupeKey: `private-story:${id}:${recipientId}` } });
    const report = await api(2).post("/api/v1/reports").set(auth(2)).send({ reportedUserId: ownerId, targetType: "PRIVATE_STORY", targetPrivateStoryId: id, reasonCode: "INAPPROPRIATE_CONTENT" }).expect(201);
    expect(report.body.moderationCaseCreated).toBe(true);
    await db.user.update({ where: { id: users[3]!.id }, data: { role: "ADMIN" } });
    try {
      const review = await api(3).get(`/api/v1/admin/moderation/private-stories/${id}`).set(auth(3)).expect(200);
      expect((await api(3).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(3)).send({ decision: "REJECTED", expectedUpdatedAt: review.body.story.updatedAt, reason: "Reviewed report" }).expect(201)).body.applied).toBe(true);
      expect((await api(3).post(`/api/v1/admin/moderation/private-stories/${id}/review`).set(auth(3)).send({ decision: "APPROVED", expectedUpdatedAt: review.body.story.updatedAt }).expect(201)).body.applied).toBe(false);
    } finally {
      await db.user.update({ where: { id: users[3]!.id }, data: { role: "USER" } });
    }
    await api(2).get(`/api/v1/private-stories/${id}`).set(auth(2)).expect(404);
    expect((await api(2).get("/api/v1/private-stories/feed").set(auth(2)).expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(id);
    expect((await api(2).get("/api/v1/notifications").set(auth(2)).expect(200)).body.items.map((item: { id: string }) => item.id)).not.toContain(notice.id);
    await api(2).post(`/api/v1/notifications/${notice.id}/read`).set(auth(2)).expect(404);
    const ownerView = await api(0).get(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
    expect(ownerView.body.story).toMatchObject({ moderationStatus: "REJECTED", mediaUrl: null });
    await api(0).patch(`/api/v1/private-stories/${id}`).set(auth(0)).send({ text: "Cannot bypass review", audienceRule: "SELECTED", recipientIds: [recipientId] }).expect(400);
    await dispatcher.execute({ notificationId: notice.id });
    expect((await db.notification.findUniqueOrThrow({ where: { id: notice.id } })).status).toBe("CANCELED");
    await api(0).delete(`/api/v1/private-stories/${id}`).set(auth(0)).expect(200);
  });

  it("uses existing indexes for first and cursor feed and owner query plans", async () => {
    // Exercise the feed's candidate query on selective recipients, without
    // disabling sequential scans or asserting machine-specific timing limits.
    const ids = Array.from({ length: 2000 }, () => randomUUID());
    const now = new Date();
    const recipientId = users[1]!.id;
    try {
      await db.privateStory.createMany({ data: ids.map((id, index) => ({
        id, ownerId: users[0]!.id, text: "Query plan fixture", audienceRule: "SELECTED",
        moderationStatus: "APPROVED", expiresAt: new Date(now.getTime() + 3_600_000),
        createdAt: new Date(now.getTime() - index * 1000),
      })) });
      await db.privateStoryGrant.createMany({ data: ids.map((storyId, index) => ({
        storyId, recipientId: index % 100 === 0 ? recipientId : users[2]!.id,
      })) });
      await db.$executeRaw`ANALYZE "PrivateStory"`;
      await db.$executeRaw`ANALYZE "PrivateStoryGrant"`;
      for (const cursor of [Prisma.empty, Prisma.sql`AND (s."createdAt" < ${now}
        OR (s."createdAt" = ${now} AND s.id < ${ids[0]}::uuid))`]) {
        const plan = await db.$queryRaw<Array<{ "QUERY PLAN": Prisma.JsonValue }>>(Prisma.sql`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          SELECT s.* FROM "PrivateStory" s
          WHERE s."ownerId" <> ${recipientId}::uuid AND s."deletedAt" IS NULL AND s."expiresAt" > ${now}
            AND EXISTS (SELECT 1 FROM "PrivateStoryGrant" g
              WHERE g."storyId" = s.id AND g."recipientId" = ${recipientId}::uuid)
            ${cursor}
          ORDER BY s."createdAt" DESC, s.id DESC LIMIT 50`);
        expect(JSON.stringify(plan)).toContain("PrivateStoryGrant_recipientId_storyId_idx");
        const result = plan[0]!["QUERY PLAN"] as unknown as Array<{ "Execution Time": number }>;
        console.info("Story feed candidate query plan", { cursor: cursor !== Prisma.empty,
          fixtureStories: ids.length, executionMs: result[0]!["Execution Time"] });
      }
      const ownerBoundary = new Date(now.getTime() - 1000 * 1000);
      for (const cursor of [Prisma.empty, Prisma.sql`AND (s."createdAt" < ${ownerBoundary}
        OR (s."createdAt" = ${ownerBoundary} AND s.id < ${ids[1000]}::uuid))`]) {
        const plan = await db.$queryRaw<Array<{ "QUERY PLAN": Prisma.JsonValue }>>(Prisma.sql`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          SELECT s.* FROM "PrivateStory" s
          WHERE s."ownerId" = ${users[0]!.id}::uuid AND s."deletedAt" IS NULL AND s."expiresAt" > ${now}
            ${cursor}
          ORDER BY s."createdAt" DESC, s.id DESC LIMIT 21`);
        expect(JSON.stringify(plan)).toContain("PrivateStory_ownerId_createdAt_id_idx");
        const result = plan[0]!["QUERY PLAN"] as unknown as Array<{ "Execution Time": number }>;
        console.info("Story owner candidate query plan", { cursor: cursor !== Prisma.empty,
          fixtureStories: ids.length, executionMs: result[0]!["Execution Time"] });
      }
    } finally {
      await db.privateStoryGrant.deleteMany({ where: { storyId: { in: ids } } });
      await db.privateStory.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it.each(["revoke", "block", "unselected", "expired", "deleted", "community", "owner-suspended", "rollout-disabled"] as const)(
    "rechecks %s before listing, reading and dispatching a queued Story notice", async reason => {
      const ownerId = users[0]!.id, recipientId = users[2]!.id;
      await db.privateFollow.upsert({ where: { requesterId_ownerId: { requesterId: recipientId, ownerId } },
        create: { requesterId: recipientId, ownerId, status: "APPROVED" }, update: { status: "APPROVED" } });
      const story = await db.privateStory.create({ data: { ownerId, text: "Private caption", audienceRule: "SELECTED", moderationStatus: "APPROVED",
        expiresAt: new Date(Date.now() + 3_600_000), grants: { create: { recipientId } } } });
      const dispatcher = app.get(NotificationDispatchService);
      await dispatcher.execute({ type: "PRIVATE_STORY_SHARED", storyId: story.id });
      const notification = await db.notification.findFirstOrThrow({ where: { userId: recipientId, dedupeKey: `private-story:${story.id}:${recipientId}` } });
      try {
        if (reason === "revoke") await db.privateFollow.deleteMany({ where: { requesterId: recipientId, ownerId } });
        if (reason === "block") await db.block.create({ data: { blockerId: recipientId, blockedId: ownerId } });
        if (reason === "unselected") await db.privateStoryGrant.deleteMany({ where: { storyId: story.id } });
        if (reason === "expired") await db.privateStory.update({ where: { id: story.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        if (reason === "deleted") await db.privateStory.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
        if (reason === "community") await db.privateStory.update({ where: { id: story.id }, data: { communityFilter: "GAY" } });
        if (reason === "owner-suspended") await db.user.update({ where: { id: ownerId }, data: { status: "SUSPENDED" } });
        if (reason === "rollout-disabled") await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { enabled: false } });
        expect((await api(2).get("/api/v1/notifications?limit=50").set(auth(2)).expect(200)).body.items.map((item: { id: string }) => item.id))
          .not.toContain(notification.id);
        await api(2).post(`/api/v1/notifications/${notification.id}/read`).set(auth(2)).expect(404);
        await dispatcher.execute({ notificationId: notification.id });
        expect((await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).status).toBe("CANCELED");
      } finally {
        await db.block.deleteMany({ where: { blockerId: recipientId, blockedId: ownerId } });
        await db.user.update({ where: { id: ownerId }, data: { status: "ACTIVE" } });
        await db.featureFlag.update({ where: { key: "private_stories.v1" }, data: { enabled: true } });
        await db.privateStory.update({ where: { id: story.id }, data: { deletedAt: new Date() } });
      }
    },
  );
});
