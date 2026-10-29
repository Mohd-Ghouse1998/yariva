import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { ensureDuoConversation } from "../../src/modules/conversations/infrastructure/conversations.infrastructure";
import { ObjectStorageService } from "../../src/integrations/object-storage/object-storage.service";
import { DuoPlanService } from "../../src/modules/wingman/application/duo-plan.service";
import { io, type Socket } from "socket.io-client";

const describeLive = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
type Account = { id: string; token: string; sessionId: string; email: string };

describeLive("Duo chat authorization and transactional consent", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let accounts: Account[];
  const runId = randomUUID();
  const objectKey = `duo-verification/${runId}/private.jpg`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    prisma = app.get(PrismaService);
    const upload = await app.get(ObjectStorageService).createPresignedPutObject({ bucket: "message-attachments", objectKey, mimeType: "image/jpeg", uploadToken: runId, userId: runId, sha256: null, expiresInSeconds: 120 });
    expect((await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: Buffer.from("private-test-image"), signal: AbortSignal.timeout(10000) })).ok).toBe(true);
    accounts = [];
    for (let index = 0; index < 5; index++) {
      const result = await request(app.getHttpServer()).post("/api/v1/auth/signup").send({
        email: `duo-${runId}-${index}@example.com`, password: "StrongPassw0rd!",
        device: { deviceId: `duo-${runId}-${index}`, platform: "ANDROID", appVersion: "test" },
      }).timeout(10000).expect(201);
      accounts.push({ id: result.body.user.id, token: result.body.tokens.accessToken, sessionId: result.body.tokens.session.id, email: `duo-${runId}-${index}@example.com` });
      await prisma.userProfile.update({ where: { userId: result.body.user.id }, data: { displayName: `Member ${index + 1}` } });
    }
  });
  afterAll(async () => {
    try { if (app) await app.get(ObjectStorageService).deleteObject({ bucket: "message-attachments", objectKey }); }
    finally { await app?.close(); }
  });

  function api(index: number, method: "get" | "post" | "patch" | "delete", path: string) {
    return request(app.getHttpServer())[method](`/api/v1/${path}`).set("Authorization", `Bearer ${accounts[index]!.token}`).timeout(10000);
  }

  async function group() {
    await prisma.block.updateMany({ where: { blockerId: { in: accounts.map(a => a.id) }, blockedId: { in: accounts.map(a => a.id) } }, data: { deletedAt: new Date() } });
    // Retain history; close earlier test parties before reserving the same accounts.
    await prisma.wingmanParty.updateMany({ where: { createdByUserId: { in: accounts.map(a => a.id) }, status: "ACTIVE" }, data: { status: "DISCONNECTED" } });
    await prisma.wingmanPartyMember.updateMany({ where: { userId: { in: accounts.map(a => a.id) }, status: "ACTIVE" }, data: { status: "DISCONNECTED" } });
    return prisma.$transaction(async tx => {
      const parties = [];
      for (const offset of [0, 2]) parties.push(await tx.wingmanParty.create({ data: {
        status: "ACTIVE", createdByUserId: accounts[offset]!.id,
        members: { create: [0, 1].map(index => ({ userId: accounts[offset + index]!.id, status: "ACTIVE" as const, role: index === 0 ? "OWNER" as const : "BUDDY" as const })) },
      } }));
      parties.sort((a, b) => a.id.localeCompare(b.id));
      const match = await tx.wingmanPairMatch.create({ data: { partyLowId: parties[0]!.id, partyHighId: parties[1]!.id, partyLowMembershipVersion: 1, partyHighMembershipVersion: 1 } });
      const conversation = await ensureDuoConversation(tx, match.id, accounts.slice(0, 4).map(a => a.id));
      return { id: conversation.id, partyId: parties[0]!.id, matchId: match.id };
    });
  }

  function nextEvent(socket: Socket, event: string, matches: (payload: any) => boolean = () => true): Promise<any> {
    return new Promise((resolve, reject) => {
      const listener = (payload: any) => { if (matches(payload)) { clearTimeout(timer); socket.off(event, listener); resolve(payload); } };
      const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Missing socket event: ${event}`)); }, 6000);
      socket.on(event, listener);
    });
  }

  it("takes four accounts from invitations and current Scene consent through concurrent votes, chat and meetup; a replacement buddy cannot read old history", async () => {
    await group(); // Close existing test reservations without deleting history.
    await prisma.wingmanParty.updateMany({ where: { createdByUserId: { in: accounts.map(a => a.id) }, status: "ACTIVE" }, data: { status: "DISCONNECTED" } });
    await prisma.wingmanPartyMember.updateMany({ where: { userId: { in: accounts.map(a => a.id) }, status: "ACTIVE" }, data: { status: "DISCONNECTED" } });
    await prisma.featureFlag.upsert({ where: { key: "wingman.v1" }, create: { key: "wingman.v1", enabled: true }, update: { enabled: true } });
    await prisma.userProfile.updateMany({ where: { userId: { in: accounts.map(a => a.id) } }, data: { isComplete: true, dateOfBirth: new Date("2000-01-01"), gender: "MAN", locationLat: 17.44, locationLng: 78.39, locationUpdatedAt: new Date() } });
    const parties: string[] = [];
    for (const owner of [0, 2]) {
      const invitations = await Promise.all([0, 1].map(() => api(owner, "post", "wingman/invitations").send({ identifier: accounts[owner + 1]!.email })));
      expect(invitations.map(r => r.status).sort()).toEqual([201, 409]);
      const invited = invitations.find(r => r.status === 201)!;
      const id = invited.body.party.id;
      parties.push(id);
      await api(owner + 1, "post", "wingman/invitations/accept").send({}).expect(200);
      for (const member of [owner, owner + 1]) {
        const scene = await prisma.scene.create({ data: { ownerId: accounts[member]!.id, lineageId: randomUUID(), intent: "FRIENDSHIP", activity: "Coffee together", canonicalActivity: "coffee", activityTokens: ["coffee"], expiresAt: new Date(Date.now() + 86400000) } });
        await api(member, "post", `wingman/parties/${id}/scene-consent`).send({ sceneId: scene.id, sceneVersion: 1 }).expect(200);
      }
    }
    const discovered = await api(0, "get", "wingman/discovery").expect(200);
    expect(discovered.body.items.some((item: any) => item.partyId === parties[1])).toBe(true);
    const votes = await Promise.all([0, 1, 2, 3].map(i => api(i, "post", `wingman/discovery/${parties[i < 2 ? 1 : 0]}/vote`).send({ decision: "APPROVE" }).expect(200)));
    expect(votes.filter(r => r.body.outcome === "PAIR_MATCH_CREATED")).toHaveLength(1);
    const matched = await api(0, "get", "wingman/discovery").expect(200);
    const conversationId = matched.body.match.conversationId;
    expect(conversationId).toBeTruthy();
    const duplicate = await api(3, "post", `wingman/discovery/${parties[0]}/vote`).send({ decision: "APPROVE" }).expect(200);
    expect(duplicate.body.match.conversationId).toBe(conversationId);
    const message = await api(0, "post", `conversations/${conversationId}/messages`).send({ clientMessageId: randomUUID(), textBody: "Our private group history" }).expect(201);
    for (const i of [1, 2, 3]) expect((await api(i, "get", `conversations/${conversationId}/messages`).expect(200)).body.items[0].id).toBe(message.body.message.id);
    const plan = await api(0, "post", `wingman/conversations/${conversationId}/plans`).send({ requestId: randomUUID(), activity: "Coffee", venueName: "Synthetic café", publicLocality: "Hyderabad", startAt: new Date(Date.now() + 86400000).toISOString() }).expect(201);
    await Promise.all([1, 2, 3].map(i => api(i, "post", `wingman/plans/${plan.body.id}/respond`).send({ action: "ACCEPT", expectedVersion: 1 }).expect(201)));
    expect((await api(0, "get", `wingman/conversations/${conversationId}/plans`).expect(200)).body.items[0].status).toBe("ACCEPTED");
    await api(1, "post", `wingman/parties/${parties[0]}/leave`).send({}).expect(200);
    const replacement = await api(0, "post", "wingman/invitations").send({ identifier: accounts[4]!.email }).expect(201);
    await api(4, "post", "wingman/invitations/accept").send({}).expect(200);
    expect(replacement.body.party.id).not.toBe(parties[0]);
    for (let i = 0; i < 5; i++) await api(i, "get", `conversations/${conversationId}/messages`).expect(404);
    expect((await prisma.duoPlan.findUniqueOrThrow({ where: { id: plan.body.id } })).status).toBe("CANCELLED");
  });

  it("delivers real socket messages to all four only, then removes access after a live block", async () => {
    const c = await group();
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("HTTP test server is not listening");
    const sockets = accounts.map(account => io(`http://127.0.0.1:${address.port}/ws`, {
      autoConnect: false, transports: ["websocket"], auth: { accessToken: account.token, sessionId: account.sessionId },
    }));
    try {
      const ready = sockets.map(socket => nextEvent(socket, "system.ready"));
      sockets.forEach(socket => socket.connect());
      await Promise.all(ready);
      const outsiderMessage = jest.fn();
      sockets[4]!.on("conversation.message.created", outsiderMessage);
      const received = sockets.slice(0, 4).map(socket => nextEvent(socket, "conversation.message.created"));
      const sent = await api(0, "post", `conversations/${c.id}/messages`).send({ clientMessageId: randomUUID(), textBody: "Realtime for our Duo" }).expect(201);
      for (const event of await Promise.all(received)) expect(event.message.id).toBe(sent.body.message.id);
      expect(outsiderMessage).not.toHaveBeenCalled();
      const closed = sockets.slice(0, 4).map(socket => nextEvent(socket, "conversation.closed", event => event.conversationId === c.id));
      await api(0, "post", "blocks").send({ blockedUserId: accounts[2]!.id }).expect(200);
      for (const event of await Promise.all(closed)) expect(event.conversationId).toBe(c.id);
      await api(1, "post", `conversations/${c.id}/messages`).send({ clientMessageId: randomUUID(), textBody: "Must not send" }).expect(404);
      await prisma.block.updateMany({ where: { blockerId: accounts[0]!.id, blockedId: accounts[2]!.id }, data: { deletedAt: new Date() } });
    } finally { sockets.forEach(socket => socket.disconnect()); }
  });

  it("has exactly four immutable members, authorizes all four, rejects outsiders, and deduplicates concurrent sends", async () => {
    const c = await group();
    for (let i = 0; i < 4; i++) {
      const result = await api(i, "get", `conversations/${c.id}`).expect(200);
      expect(result.body.conversation).toMatchObject({ kind: "DUO", matchId: null, duoMatchId: c.matchId });
      expect(result.body.conversation.participants).toHaveLength(4);
    }
    await api(4, "get", `conversations/${c.id}`).expect(404);
    await expect(prisma.conversationMember.create({ data: { conversationId: c.id, userId: accounts[4]!.id } })).rejects.toThrow();
    await expect(prisma.conversationMember.updateMany({ where: { conversationId: c.id, userId: accounts[0]!.id }, data: { userId: accounts[4]!.id } })).rejects.toThrow();
    const requestId = randomUUID();
    const sends = await Promise.all([0, 1].map(() => api(0, "post", `conversations/${c.id}/messages`).send({ clientMessageId: requestId, textBody: "Hello everyone" }).expect(201)));
    expect(sends[0]!.body.message.id).toBe(sends[1]!.body.message.id);
    const id = sends[0]!.body.message.id;
    const next = await api(1, "post", `conversations/${c.id}/messages`).send({ clientMessageId: randomUUID(), textBody: "Hi!" }).expect(201);
    const reads = await Promise.all([2, 1].map(lastReadSequence => api(2, "post", `conversations/${c.id}/read`).send({ lastReadSequence })));
    expect(reads[0]!.status).toBe(200);
    expect([200, 400]).toContain(reads[1]!.status);
    expect((await prisma.conversationRead.findUniqueOrThrow({ where: { conversationId_userId: { conversationId: c.id, userId: accounts[2]!.id } } })).lastReadSequence).toBe(2);
    await api(0, "patch", `messages/${id}`).send({ textBody: "Hello Duo" }).expect(200);
    await api(1, "patch", `messages/${id}`).send({ textBody: "Not mine" }).expect(403);
    await api(2, "post", "reports").send({ reportedUserId: accounts[0]!.id, targetType: "MESSAGE", targetMessageId: id, reasonCode: "OTHER" }).expect(201);
    await api(4, "post", "reports").send({ reportedUserId: accounts[0]!.id, targetType: "MESSAGE", targetMessageId: id, reasonCode: "OTHER" }).expect(400);
    await api(1, "delete", `messages/${next.body.message.id}`).expect(204);
  });

  it("protects media, drops old member access on departure, and never grants old history to a new buddy", async () => {
    const c = await group();
    const message = await prisma.message.create({ data: { conversationId: c.id, senderId: accounts[0]!.id, sequence: 1, type: "IMAGE", attachmentObjectKey: objectKey, attachmentBucket: "message-attachments", attachmentMimeType: "image/jpeg", attachmentModerationStatus: "APPROVED" } });
    const page = await api(2, "get", `conversations/${c.id}/messages`).expect(200);
    expect(page.body.items[0].attachment).toMatchObject({ objectKey: null, url: `messages/${message.id}/attachment` });
    await api(2, "get", `messages/${message.id}/attachment`).expect(200).expect("Cache-Control", "private, no-store");
    await api(4, "get", `messages/${message.id}/attachment`).expect(404);
    await prisma.message.update({ where: { id: message.id }, data: { attachmentModerationStatus: "PENDING" } });
    await api(2, "get", `messages/${message.id}/attachment`).expect(404);
    await api(0, "get", `messages/${message.id}/attachment`).expect(200);
    await prisma.wingmanPartyMember.updateMany({ where: { partyId: c.partyId, status: "ACTIVE" }, data: { status: "DISCONNECTED" } });
    for (let i = 0; i < 5; i++) {
      await api(i, "get", `conversations/${c.id}/messages`).expect(404);
      await api(i, "get", `messages/${message.id}/attachment`).expect(404);
    }
    await api(0, "delete", `messages/${message.id}`).expect(409);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("CLOSED_UNMATCHED");
    expect(await prisma.conversationMember.count({ where: { conversationId: c.id } })).toBe(4);
  });

  it("requires four current-version plan acceptances, resets counters, and closes everything on block", async () => {
    const c = await group();
    const plans = app.get(DuoPlanService);
    const input = { requestId: randomUUID(), activity: "Coffee", venueName: "Public café", publicLocality: "Hyderabad", startAt: new Date(Date.now() + 86400000).toISOString() };
    const plan = await plans.create(accounts[0]!.id, c.id, input);
    expect((await plans.create(accounts[0]!.id, c.id, input)).id).toBe(plan.id);
    await Promise.all([1, 2, 3].map(i => plans.respond(accounts[i]!.id, plan.id, { action: "ACCEPT", expectedVersion: 1 })));
    expect((await plans.list(accounts[0]!.id, c.id)).items[0]!.status).toBe("ACCEPTED");
    const counterInput = { ...input, requestId: randomUUID(), venueName: "Another public café", expectedVersion: 1 };
    const [counter, replay] = await Promise.all([0, 1].map(() => plans.counter(accounts[2]!.id, plan.id, counterInput)));
    expect(counter).toMatchObject({ version: 2, status: "COUNTERED", acceptedUserIds: [accounts[2]!.id] });
    expect(replay?.version).toBe(2);
    await expect(plans.respond(accounts[1]!.id, plan.id, { action: "ACCEPT", expectedVersion: 1 })).rejects.toMatchObject({ code: "DATE_PLAN_INVALID_STATE" });
    expect((await plans.respond(accounts[3]!.id, plan.id, { action: "CANCEL", expectedVersion: 2 })).status).toBe("CANCELLED");
    await expect(plans.respond(accounts[1]!.id, plan.id, { action: "ACCEPT", expectedVersion: 2 })).rejects.toThrow();
    const replacement = await plans.create(accounts[0]!.id, c.id, { ...input, requestId: randomUUID() });
    await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: accounts[0]!.id, blockedId: accounts[2]!.id } }, create: { blockerId: accounts[0]!.id, blockedId: accounts[2]!.id }, update: { deletedAt: null } });
    expect((await prisma.duoPlan.findUniqueOrThrow({ where: { id: replacement.id } })).status).toBe("CANCELLED");
    for (let i = 0; i < 4; i++) await api(i, "get", `conversations/${c.id}`).expect(404);
    await expect(plans.respond(accounts[3]!.id, plan.id, { action: "ACCEPT", expectedVersion: 2 })).rejects.toThrow();
  });

  it("reuses reviewed venue ranking without revealing group locations and handles stale origins", async () => {
    const c = await group();
    await prisma.userProfile.updateMany({ where: { userId: { in: accounts.slice(0, 4).map(a => a.id) } }, data: { locationLat: 17.44, locationLng: 78.39, locationUpdatedAt: new Date() } });
    const base = { address: "Synthetic public-place test address", publicLocality: runId, city: "Hyderabad", countryCode: "IN", latitude: 17.44, longitude: 78.39, category: "CAFE" as const, reviewSource: "Isolated integration fixture", reviewedAt: new Date(), isSynthetic: true };
    const high = await prisma.reviewedVenue.create({ data: { ...base, name: "Fixture café A", rating: 4.8, ratingCount: 100, reviewStatus: "REVIEWED" } });
    await prisma.reviewedVenue.create({ data: { ...base, name: "Fixture café B", rating: 4.2, ratingCount: 1000, reviewStatus: "REVIEWED" } });
    const pending = await prisma.reviewedVenue.create({ data: { ...base, name: "Unreviewed fixture", rating: 5, reviewStatus: "PENDING" } });
    const plans = app.get(DuoPlanService);
    const page = await plans.venueSuggestions(accounts[0]!.id, c.id, { query: runId, locationMode: "MIDPOINT" });
    expect(page.items[0]?.id).toBe(high.id);
    expect(page.items.map(item => item.id)).not.toContain(pending.id);
    expect(page.items.every(item => item.distanceKm === null)).toBe(true);
    expect(JSON.stringify(page)).not.toMatch(/latitude|longitude|locationLat|locationLng/);
    await prisma.userProfile.update({ where: { userId: accounts[3]!.id }, data: { locationUpdatedAt: new Date("2020-01-01") } });
    expect((await plans.venueSuggestions(accounts[0]!.id, c.id, { query: runId })).items).toHaveLength(0);
    expect((await plans.venueSuggestions(accounts[0]!.id, c.id, { locationMode: "AREA", area: runId })).items).toHaveLength(2);
    await api(4, "get", `wingman/conversations/${c.id}/venues?locationMode=AREA&area=${runId}`).expect(404);
  });

  it("rechecks queued sends, edits and read receipts after a departing-party transaction commits", async () => {
    const c = await group();
    const sent = await api(0, "post", `conversations/${c.id}/messages`).send({ clientMessageId: randomUUID(), textBody: "Before departure" }).expect(201);
    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const departure = prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.partyId}, 0))`;
      locked(); await hold;
      await tx.wingmanParty.update({ where: { id: c.partyId }, data: { status: "DISCONNECTED", membershipVersion: { increment: 1 } } });
    }, { timeout: 10000 });
    await ready;
    const queued = [
      api(1, "post", `conversations/${c.id}/messages`).send({ clientMessageId: randomUUID(), textBody: "Queued send" }),
      api(0, "patch", `messages/${sent.body.message.id}`).send({ textBody: "Queued edit" }),
      api(2, "post", `conversations/${c.id}/read`).send({ lastReadSequence: 1 }),
    ].map(call => call.then(response => response.status));
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const rows = await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'`;
        if ((rows[0]?.count ?? 0) >= 1) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
    } finally { release(); }
    await departure;
    for (const status of await Promise.all(queued)) expect([404, 409]).toContain(status);
    expect(await prisma.message.count({ where: { conversationId: c.id } })).toBe(1);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: sent.body.message.id } })).textBody).toBe("Before departure");
    expect((await prisma.conversationRead.findUniqueOrThrow({ where: { conversationId_userId: { conversationId: c.id, userId: accounts[2]!.id } } })).lastReadSequence).toBe(0);
  });

  async function solo() {
    const [userLowId, userHighId] = [accounts[0]!.id, accounts[4]!.id].sort() as [string, string];
    await prisma.block.updateMany({ where: { blockerId: { in: [userLowId, userHighId] }, blockedId: { in: [userLowId, userHighId] } }, data: { deletedAt: new Date() } });
    const match = await prisma.match.upsert({ where: { userLowId_userHighId: { userLowId, userHighId } }, create: { userLowId, userHighId }, update: { status: "ACTIVE", endedAt: null, endedReason: null } });
    await prisma.conversation.upsert({ where: { matchId: match.id }, create: { matchId: match.id }, update: { status: "ACTIVE", closedReason: null, closedAt: null } });
    await prisma.callSession.updateMany({ where: { matchId: match.id, status: { in: ["RINGING", "ACCEPTED", "CONNECTING", "CONNECTED"] } }, data: { status: "ENDED", endedAt: new Date(), endReason: "HANGUP" } });
    for (const userId of [userLowId, userHighId]) await prisma.userCommunicationPreference.upsert({ where: { userId }, create: { userId, allowVoiceCalls: true, allowVideoCalls: true }, update: { allowVoiceCalls: true, allowVideoCalls: true } });
    return match;
  }

  it("keeps optional audio introductions typed, permission-gated and race-safe alongside ordinary calls", async () => {
    const match = await solo();
    const payload = { matchId: match.id, callType: "VOICE", purpose: "VOICE_INTRODUCTION" };
    await api(0, "post", "calls").send({ ...payload, callType: "VIDEO" }).expect(400);
    const duo = await group();
    await api(0, "post", "calls").send({ ...payload, matchId: duo.matchId }).expect(404);
    await prisma.userCommunicationPreference.update({ where: { userId: accounts[4]!.id }, data: { allowVoiceCalls: false } });
    await api(0, "post", "calls").send(payload).expect(403);
    await prisma.userCommunicationPreference.update({ where: { userId: accounts[4]!.id }, data: { allowVoiceCalls: true } });
    const attempts = await Promise.all([0, 1].map(() => api(0, "post", "calls").send(payload)));
    expect(attempts.map(r => r.status).sort()).toEqual([201, 409]);
    const call = attempts.find(r => r.status === 201)!.body.call;
    expect(call).toMatchObject({ purpose: "VOICE_INTRODUCTION", callType: "VOICE", status: "RINGING" });
    expect(["general", "coffee", "food", "walk", "study"]).toContain(call.introductionPrompt);
    expect((await api(4, "get", "calls/pending").expect(200)).body.invitation.call.id).toBe(call.id);
    expect((await api(1, "get", "calls/pending").expect(200)).body.invitation).toBeNull();
    await api(1, "get", `calls/${call.id}`).expect(404);
    await api(0, "post", `calls/${call.id}/accept`).send({}).expect(403);
    await api(4, "post", `calls/${call.id}/decline`).send({}).expect(200);
    expect((await api(0, "get", `calls/${call.id}`).expect(200)).body.call.status).toBe("DECLINED");
    expect((await api(4, "get", "calls/pending").expect(200)).body.invitation).toBeNull();
    const ordinary = await api(0, "post", "calls").send({ matchId: match.id, callType: "VOICE" }).expect(201);
    expect(ordinary.body.call).toMatchObject({ purpose: "STANDARD", introductionPrompt: null });
    await api(0, "post", `calls/${ordinary.body.call.id}/end`).send({ reason: "HANGUP" }).expect(200);
    const intro = await api(0, "post", "calls").send(payload).expect(201);
    const accepted = await Promise.all([0, 1].map(() => api(4, "post", `calls/${intro.body.call.id}/accept`).send({}).expect(200)));
    expect(accepted.every(r => r.body.call.status === "ACCEPTED")).toBe(true);
    expect((await api(4, "get", `calls/${intro.body.call.id}`).expect(200)).body.call.purpose).toBe("VOICE_INTRODUCTION");
    await api(0, "post", `calls/${intro.body.call.id}/end`).send({ reason: "HANGUP" }).expect(200);
    const expired = await api(0, "post", "calls").send(payload).expect(201);
    await prisma.callSession.update({ where: { id: expired.body.call.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await api(4, "post", `calls/${expired.body.call.id}/accept`).send({}).expect(409);
    expect((await api(4, "get", `calls/${expired.body.call.id}`).expect(200)).body.call.status).toBe("MISSED");
  });

  it("revalidates queued call initiation after unmatch and rejects late acceptance after block", async () => {
    const match = await solo();
    let release!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    const unmatch = prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM "Match" WHERE id=${match.id}::uuid FOR UPDATE`;
      locked(); await hold;
      await tx.match.update({ where: { id: match.id }, data: { status: "ENDED", endedAt: new Date(), endedReason: "UNMATCHED" } });
    }, { timeout: 10000 });
    await ready;
    const attempt = api(0, "post", "calls").send({ matchId: match.id, callType: "VOICE", purpose: "VOICE_INTRODUCTION" }).then(r => r.status);
    try {
      for (let i = 0; i < 50; i++) {
        const waits = await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`;
        if ((waits[0]?.count ?? 0) > 0) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { release(); }
    await unmatch;
    expect(await attempt).toBe(409);
    await solo();
    const call = await api(0, "post", "calls").send({ matchId: match.id, callType: "VOICE", purpose: "VOICE_INTRODUCTION" }).expect(201);
    await api(4, "post", "blocks").send({ blockedUserId: accounts[0]!.id }).expect(200);
    await api(4, "post", `calls/${call.body.call.id}/accept`).send({}).expect(409);
    expect((await api(0, "get", `calls/${call.body.call.id}`).expect(200)).body.call).toMatchObject({ status: "ENDED", endReason: "BLOCKED" });
  });
});
