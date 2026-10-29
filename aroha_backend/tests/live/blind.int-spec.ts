import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { BlindService } from "../../src/modules/blind/application/blind.service";
import { ObjectStorageService } from "../../src/integrations/object-storage/object-storage.service";

const live = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
live("Blind introductions: real persisted privacy, consent and time", () => {
  let app: NestExpressApplication, db: PrismaService, blind: BlindService;
  let previousFlag: { enabled: boolean; scope: "GLOBAL" | "USER_ALLOWLIST" | "USER_PERCENTAGE"; rolloutPercentage: number | null } | null;
  const accounts: Array<{ id: string; token: string }> = [];
  const run = randomUUID();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app); app.useLogger(false); await app.init();
    db = app.get(PrismaService); blind = app.get(BlindService);
    previousFlag = await db.featureFlag.findUnique({ where: { key: "blind.v1" }, select: { enabled: true, scope: true, rolloutPercentage: true } });
    await db.featureFlag.upsert({ where: { key: "blind.v1" }, create: { key: "blind.v1", enabled: true, scope: "GLOBAL" }, update: { enabled: true, scope: "GLOBAL", rolloutPercentage: null } });
    for (let i = 0; i < 8; i++) {
      const signup = await request(app.getHttpServer()).post("/api/v1/auth/signup").send({ email: `blind-${run}-${i}@example.com`, password: "StrongPassw0rd!", device: { deviceId: `${run}-${i}`, platform: "ANDROID", appVersion: "test" } }).expect(201);
      accounts.push({ id: signup.body.user.id, token: signup.body.tokens.accessToken });
      await db.userProfile.update({ where: { userId: signup.body.user.id }, data: { displayName: `Blind test ${i}`, isComplete: true, dateOfBirth: new Date("2000-01-01"), gender: "MAN", city: "Hyderabad", locationLat: 17.44, locationLng: 78.39, locationUpdatedAt: new Date() } });
      await db.profilePhoto.create({ data: { userId: signup.body.user.id, bucket: "external", objectKey: `https://example.com/private-${run}-${i}.jpg`, mimeType: "image/jpeg", sizeBytes: 100, position: 0, isPrimary: true, moderationStatus: "APPROVED" } });
    }
  });
  afterAll(async () => {
    if (db && previousFlag) await db.featureFlag.update({ where: { key: "blind.v1" }, data: previousFlag });
    else if (db) await db.featureFlag.deleteMany({ where: { key: "blind.v1" } });
    await app?.close();
  });
  const api = (i: number, method: "get" | "post", path: string) => request(app.getHttpServer())[method](`/api/v1/${path}`).set("Authorization", `Bearer ${accounts[i]!.token}`).timeout(10000);
  async function event(indices: number[], offset = -1000, end = 3600000) {
    const e = await blind.schedule({ startsAt: new Date(Date.now() + offset).toISOString(), endsAt: new Date(Date.now() + end).toISOString(), city: "Hyderabad" });
    for (const i of indices) await api(i, "post", `blind/events/${e.id}/join`).send({ intent: "FRIENDSHIP", blindConsent: true, notificationsEnabled: i === 0 }).expect(201);
    return e;
  }
  async function pair(a: number, b: number) {
    const e = await event([a, b]);
    expect((await api(a, "post", `blind/events/${e.id}/interest/${accounts[b]!.id}`).expect(201)).body.state).toBe("WAITING");
    const responses = await Promise.all([0, 1].map(() => api(b, "post", `blind/events/${e.id}/interest/${accounts[a]!.id}`).expect(201)));
    expect(responses[0]!.body.conversationId).toBe(responses[1]!.body.conversationId);
    const conversationId = responses[0]!.body.conversationId;
    const c = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    return { e, conversationId, matchId: c.matchId! };
  }
  it("requires explicit consent, honors real boundaries without worker, and enforces operator access", async () => {
    const e = await event([], 60000, 120000);
    await api(0, "post", `blind/events/${e.id}/join`).send({ intent: "FRIENDSHIP", blindConsent: false, notificationsEnabled: false }).expect(400);
    await api(0, "post", `blind/events/${e.id}/join`).send({ intent: "FRIENDSHIP", blindConsent: true, notificationsEnabled: true }).expect(201);
    await api(0, "post", `blind/events/${e.id}/interest/${accounts[1]!.id}`).expect(409);
    await api(0, "post", "admin/blind/events").send({ startsAt: e.startsAt, endsAt: e.endsAt, city: "Hyderabad" }).expect(403);
    await api(0, "post", `blind/events/${e.id}/leave`).expect(201);
    expect((await api(0, "get", `blind/events/${e.id}`).expect(200)).body.enrollment.state).toBe("LEFT");
    await blind.cancel(e.id);
    expect((await api(0, "get", `blind/events/${e.id}`).expect(200)).body.occurrence.state).toBe("CANCELLED");
    await api(0, "post", `blind/events/${e.id}/join`).send({ intent: "FRIENDSHIP", blindConsent: true, notificationsEnabled: false }).expect(409);
  });
  it("protects every mapped original and attachment/video path, reveals only by mutual consent", async () => {
    const { e, conversationId, matchId } = await pair(0, 1);
    for (const path of [`profiles/${accounts[1]!.id}`, `matches/${matchId}`, `conversations/${conversationId}`, "conversations", "matches"]) {
      const response = await api(0, "get", path).expect(200);
      expect(JSON.stringify(response.body)).not.toContain(`private-${run}-1.jpg`);
    }
    expect((await api(0, "get", `profiles/${accounts[1]!.id}`).expect(200)).body.profile.photos[0].url).toMatch(/^data:image\/png/);
    await api(0, "post", "messages/attachments/upload").send({ conversationId, fileName: "hidden.jpg", mimeType: "image/jpeg", sizeBytes: 100 }).expect(409);
    await api(0, "post", "calls").send({ matchId, callType: "VIDEO" }).expect(403);
    await api(2, "get", `blind/relationships/${matchId}`).expect(404);
    await api(0, "post", `blind/relationships/${matchId}/reveal`).expect(201);
    expect((await api(1, "get", `blind/relationships/${matchId}`).expect(200)).body.blind).toMatchObject({ isBlindVibeActive: true, myRevealConsent: false, otherRevealConsent: true });
    expect((await api(1, "post", `blind/relationships/${matchId}/reveal`).expect(201)).body.blind.isBlindVibeActive).toBe(false);
    expect(JSON.stringify((await api(0, "get", `profiles/${accounts[1]!.id}`).expect(200)).body)).toContain(`private-${run}-1.jpg`);
    await db.blindEventOccurrence.update({ where: { id: e.id }, data: { startsAt: new Date(Date.now() - 120000), endsAt: new Date(Date.now() - 1), state: "LIVE" } });
    const ended = await api(0, "get", `blind/events/${e.id}`).expect(200);
    expect(ended.body.occurrence.state).toBe("ENDED"); expect(ended.body.matches[0].conversationId).toBe(conversationId);
    await api(0, "post", `blind/events/${e.id}/interest/${accounts[1]!.id}`).expect(409);
    await api(0, "post", `conversations/${conversationId}/messages`).send({ clientMessageId: randomUUID(), textBody: "We can keep talking after the event" }).expect(201);
    await blind.reconcile(); await blind.reconcile();
    expect(await db.notification.count({ where: { dedupeKey: `blind:${e.id}:ENDED:${accounts[0]!.id}` } })).toBe(1);
    expect(await db.notification.count({ where: { dedupeKey: `blind:${e.id}:ENDED:${accounts[1]!.id}` } })).toBe(0);
  });
  it("counts five unique eligible texts each, never retries, repeated content, rapid spam or forged time", async () => {
    const { conversationId, matchId } = await pair(2, 3);
    const send = (i: number, textBody: string, clientMessageId = randomUUID()) => api(i, "post", `conversations/${conversationId}/messages`).send({ clientMessageId, textBody }).expect(201);
    const id = randomUUID();
    await Promise.all([send(2, "Hello there!", id), send(2, "Hello there!", id)]);
    await send(2, "Rapid different message"); await send(3, "A first hello");
    await api(2, "post", `conversations/${conversationId}/messages`).send({ clientMessageId: randomUUID(), textBody: "Forged time", createdAt: "2099-01-01" }).expect(400);
    expect((await api(2, "get", `blind/relationships/${matchId}`).expect(200)).body.blind.interactionCount).toBe(2);
    await new Promise(resolve => setTimeout(resolve, 10100));
    await send(2, " HELLO, THERE!!! ");
    expect((await api(2, "get", `blind/relationships/${matchId}`).expect(200)).body.blind.interactionCount).toBe(2);
    for (let n = 2; n <= 5; n++) {
      if (n > 2) await new Promise(resolve => setTimeout(resolve, 10100));
      await Promise.all([send(2, `My unique thought ${n}`), send(3, `My different answer ${n}`)]);
      const policy = (await api(2, "get", `blind/relationships/${matchId}`).expect(200)).body.blind;
      expect(policy.interactionCount).toBe(n * 2); expect(policy.isBlindVibeActive).toBe(n !== 5);
    }
    await expect(db.blindRelationship.update({ where: { matchId }, data: { lowCount: 0, revealedAt: null } })).rejects.toThrow();
  });
  it("never retroactively hides issued images and serializes exposure against introduction", async () => {
    const e = await event([4, 5]);
    await app.get(ObjectStorageService).canDiscloseMedia({ viewerId: accounts[4]!.id, ownerId: accounts[5]!.id });
    const candidates = await api(4, "get", `blind/events/${e.id}/people`).expect(200);
    expect(candidates.body.items.some((p: any) => p.userId === accounts[5]!.id)).toBe(false);
    await api(4, "post", `blind/events/${e.id}/interest/${accounts[5]!.id}`).expect(409);
    const fresh = await event([6, 7]);
    await api(6, "post", `blind/events/${fresh.id}/interest/${accounts[7]!.id}`).expect(201);
    const [disclosed, matched] = await Promise.all([
      app.get(ObjectStorageService).canDiscloseMedia({ viewerId: accounts[6]!.id, ownerId: accounts[7]!.id }),
      api(7, "post", `blind/events/${fresh.id}/interest/${accounts[6]!.id}`),
    ]);
    expect(disclosed && matched.status === 201).toBe(false);
  });
});
