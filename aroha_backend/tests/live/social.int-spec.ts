import { randomUUID } from "node:crypto";
import { getQueueToken } from "@nestjs/bullmq";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import request, { type Response } from "supertest";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { toBullmqSafeJobId } from "../../src/integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../src/integrations/object-storage/object-storage.service";
import { MessageAttachmentCleanupProcessor } from "../../src/jobs/messages/message-attachment-cleanup.processor";
import type { InitiateMessageAttachmentUploadResponseDto } from "../../src/modules/messages/dto/messages.dto";
import { ApplyAccountActionService } from "../../src/modules/moderation/application/moderation.services";
import { NotificationDispatchService } from "../../src/modules/notifications/application/notifications.services";
import { FcmPushTransport } from "../../src/modules/notifications/infrastructure/push-transports";
import { CHECK_IN_FLAG, CIRCLES_FLAG, FIRST_CONNECTIONS_FLAG } from "../../src/modules/social/social-access";

const describeLive = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;

describeLive("Circles and connection check-in through the live API", () => {
  const run = randomUUID();
  const objectKey = `social-verification/${run}/private.jpg`;
  const accounts: { id: string; token: string; sessionId: string }[] = [];
  let app: NestExpressApplication;
  let db: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app);
    app.useLogger(false);
    await app.listen(0, "127.0.0.1");
    db = app.get(PrismaService);
    for (const [index, gender] of ["NON_BINARY", "TRANS_WOMAN", "WOMAN", "MAN", "TRANS_MAN", "AGENDER"].entries()) {
      const { body } = await request(app.getHttpServer()).post("/api/v1/auth/signup").send({
        email: `social-${run}-${index}@example.com`, password: "StrongPassw0rd!",
        device: { deviceId: `social-${run}-${index}`, platform: "ANDROID", appVersion: "test" },
      }).expect(201);
      accounts.push({ id: body.user.id, token: body.tokens.accessToken, sessionId: body.tokens.session.id });
      await db.userProfile.update({ where: { userId: body.user.id }, data: {
        displayName: `Member ${index}`, isComplete: true, completedAt: new Date(), dateOfBirth: new Date("1998-01-01"),
        gender: gender as "NON_BINARY" | "TRANS_WOMAN" | "WOMAN" | "MAN" | "TRANS_MAN" | "AGENDER",
        city: "Hyderabad", region: "Telangana", countryCode: "IN", locationLat: 17.44, locationLng: 78.39,
        locationUpdatedAt: new Date(),
      } });
    }
  });

  afterAll(async () => {
    try {
      if (app) await app.get(ObjectStorageService).deleteObject({ bucket: "message-attachments", objectKey });
    } finally {
      await app?.close();
    }
  });

  function api(index: number, method: "get" | "post" | "put" | "patch" | "delete", path: string) {
    return request(app.getHttpServer())[method](`/api/v1/${path}`)
      .set("Authorization", `Bearer ${accounts[index]!.token}`).timeout(10000);
  }

  async function flag(key: string, enabled: boolean, users = accounts) {
    const config = { enabled, scope: "USER_ALLOWLIST" as const, allowlistUserIds: users.map(({ id }) => id) };
    await db.featureFlag.upsert({ where: { key }, create: { key, ...config }, update: config });
  }

  async function createCircle(title: string) {
    const { body } = await api(0, "post", "social/circles").send({
      title: `${title} ${run.slice(0, 8)}`, description: "Meet in Hyderabad for a shared hobby", capacity: 4, intent: "FRIENDSHIP",
    }).expect(201);
    return `social/circles/${body.id}`;
  }

  function decide(group: string, index: number, approve = true) {
    return api(0, "put", `${group}/members/${accounts[index]!.id}`).send({ approve });
  }

  function notices(index: number, fields: Record<string, string | number>) {
    return db.notification.findMany({ where: {
      userId: accounts[index]!.id,
      AND: Object.entries(fields).map(([key, value]) => ({ data: { path: [key], equals: value } })),
    } });
  }

  async function completeSettingsProfile(index: number) {
    const userId = accounts[index]!.id;
    const discovery = { minAge: 18, maxAge: 99, maxDistanceKm: 100 };
    await Promise.all([
      db.userProfile.update({ where: { userId }, data: {
        bio: "A complete synthetic profile for privacy and notification tests", locationGeohash: "tek9",
      } }),
      db.userIntent.upsert({ where: { userId_intent: { userId, intent: "FRIENDSHIP" } },
        create: { userId, intent: "FRIENDSHIP" }, update: {} }),
      db.userDiscoveryPreference.upsert({ where: { userId }, create: { userId, ...discovery }, update: discovery }),
      db.userCommunicationPreference.upsert({ where: { userId }, create: { userId }, update: {} }),
    ]);
    if (!await db.profilePhoto.count({ where: { userId, isPrimary: true, moderationStatus: "APPROVED" } })) {
      await db.profilePhoto.create({ data: {
        userId, bucket: "profile-photos", objectKey: `social-verification/${run}/settings-${index}.jpg`,
        mimeType: "image/jpeg", sizeBytes: 32, moderationStatus: "APPROVED", isPrimary: true,
      } });
    }
  }

  async function protectedStory() {
    const story = await db.privateStory.create({ data: {
      ownerId: accounts[0]!.id, text: "An unrelated private Story", audienceRule: "SELECTED",
      moderationStatus: "APPROVED", expiresAt: new Date(Date.now() + 3600000),
    } });
    await api(0, "get", `private-stories/${story.id}`).expect(200);
    return `private-stories/${story.id}`;
  }

  function nextMessage(socket: Socket, conversationId: string, clientMessageId: string) {
    return new Promise<{ message: { id: string } }>((resolve, reject) => {
      const listener = (event: { conversationId: string; message: { id: string; clientMessageId: string } }) => {
        if (event.conversationId !== conversationId || event.message.clientMessageId !== clientMessageId) return;
        clearTimeout(timer);
        socket.off("conversation.message.created", listener);
        resolve(event);
      };
      const timer = setTimeout(() => {
        socket.off("conversation.message.created", listener);
        reject(new Error("Circle message was not delivered"));
      }, 5000);
      socket.on("conversation.message.created", listener);
    });
  }

  it("starts with flags disabled and only offers First Connections after recent eligible onboarding", async () => {
    await Promise.all([CIRCLES_FLAG, CHECK_IN_FLAG, FIRST_CONNECTIONS_FLAG].map(key => flag(key, false)));
    expect((await api(0, "get", "social/status").expect(200)).body)
      .toEqual({ circles: false, checkIn: false, firstConnections: false });
    await api(0, "get", "social/circles").expect(404);
    await api(0, "get", `social/conversations/${randomUUID()}/check-in`).expect(404);
    await Promise.all([CIRCLES_FLAG, CHECK_IN_FLAG, FIRST_CONNECTIONS_FLAG, "private_stories.v1"].map(key => flag(key, true)));
    expect((await api(0, "get", "social/status").expect(200)).body)
      .toEqual({ circles: true, checkIn: true, firstConnections: true });
    await db.userProfile.update({ where: { userId: accounts[5]!.id }, data: { completedAt: new Date(Date.now() - 8 * 86400000) } });
    expect((await api(5, "get", "social/status").expect(200)).body.firstConnections).toBe(false);
  });

  it("serializes capacity, protects chat and media across membership changes, and keeps Stories independent", async () => {
    const group = await createCircle("Camera club");
    const ids = accounts.map(({ id }) => id);
    const story = await protectedStory();
    const blocked = await api(0, "post", "blocks").send({ blockedUserId: ids[5] }).expect(200);
    expect(blocked.body).toBeDefined();
    await api(5, "get", group).expect(404);
    await api(5, "put", `${group}/membership`).expect(404);
    await db.block.updateMany({ where: { blockerId: ids[0], blockedId: ids[5] }, data: { deletedAt: new Date() } });
    const founderChat = (await api(0, "get", group).expect(200)).body.chatId;
    expect(founderChat).toBeTruthy();
    await Promise.all([1, 2, 3, 4, 5, 1].map(index => api(index, "put", `${group}/membership`).expect(200)));
    expect(await db.circleMembership.count({ where: { circleId: group.split("/").at(-1), status: "PENDING" } })).toBe(5);
    expect((await api(1, "get", group).expect(200)).body).toMatchObject({ ownStatus: "PENDING", chatId: null, members: [] });
    await api(1, "get", `conversations/${founderChat}/messages`).expect(404);
    await api(1, "put", `${group}/members/${ids[2]}`).send({ approve: true }).expect(404);
    await decide(group, 1).expect(200);
    await decide(group, 2).expect(200);
    await decide(group, 5, false).expect(200);
    expect((await api(5, "get", group).expect(200)).body.ownStatus).toBe("DECLINED");
    const approvals = await Promise.all([3, 4].map(index => decide(group, index)));
    expect(approvals.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = approvals[0]!.status === 200 ? 3 : 4;
    const loser = winner === 3 ? 4 : 3;
    const detail = (await api(0, "get", group).expect(200)).body;
    expect(detail).toMatchObject({ approvedCount: 4, state: "FULL" });
    const chat = detail.chatId;
    expect(detail.members[0]).toEqual(expect.objectContaining({ userId: expect.any(String), name: expect.any(String) }));
    expect(Object.keys(detail.members[0]).sort()).toEqual(["name", "userId"]);
    await api(0, "get", `conversations/${founderChat}/messages`).expect(404);
    await api(loser, "get", `conversations/${chat}/messages`).expect(404);
    await api(1, "get", story).expect(404);
    await api(0, "delete", `${group}/membership`).expect(409);

    const upload = await app.get(ObjectStorageService).createPresignedPutObject({
      bucket: "message-attachments", objectKey, mimeType: "image/jpeg",
      uploadToken: run, userId: ids[0]!, sha256: null, expiresInSeconds: 120,
    });
    expect((await fetch(upload.uploadUrl, {
      method: "PUT", headers: upload.headers, body: Buffer.from("private Circle test image"), signal: AbortSignal.timeout(10000),
    })).ok).toBe(true);
    const media = await db.message.create({ data: {
      conversationId: chat, senderId: ids[0]!, sequence: 1, type: "IMAGE", attachmentObjectKey: objectKey,
      attachmentBucket: "message-attachments", attachmentMimeType: "image/jpeg", attachmentModerationStatus: "APPROVED",
    } });
    const messages = `conversations/${chat}/messages`;
    const attachment = `messages/${media.id}/attachment`;
    await api(1, "get", messages).expect(200);
    await api(1, "get", attachment).expect(200).expect("Cache-Control", "private, no-store");
    await api(1, "post", "reports").send({ reportedUserId: ids[0], targetType: "MESSAGE", targetMessageId: media.id, reasonCode: "OTHER" }).expect(201);

    await db.userProfile.update({ where: { userId: ids[1] }, data: { isIncognito: true } });
    expect((await api(0, "get", group).expect(200)).body.members).toContainEqual({ userId: ids[1], name: "Circle member" });
    await api(0, "get", `profiles/${ids[1]}`).expect(404);
    await db.userProfile.update({ where: { userId: ids[1] }, data: { isIncognito: false } });

    await flag(CIRCLES_FLAG, true, accounts.filter((_, index) => index !== 1));
    await api(1, "get", messages).expect(404);
    await api(1, "get", attachment).expect(404);
    await flag(CIRCLES_FLAG, true);
    await db.user.update({ where: { id: ids[winner] }, data: { status: "SUSPENDED" } });
    await api(1, "get", messages).expect(404);
    await api(1, "get", attachment).expect(404);
    await db.user.update({ where: { id: ids[winner] }, data: { status: "ACTIVE" } });

    await api(1, "post", "blocks").send({ blockedUserId: ids[2] }).expect(200);
    await api(0, "get", group).expect(404);
    await api(winner, "get", messages).expect(404);
    await api(winner, "get", attachment).expect(404);
    await api(1, "delete", `${group}/membership`).expect(200);
    await api(1, "get", attachment).expect(404);
    await api(0, "get", messages).expect(404);
    const current = (await api(0, "get", group).expect(200)).body.chatId;
    expect(current).not.toBe(chat);
    await api(0, "delete", `${group}/members/${ids[winner]}`).expect(200);
    await api(winner, "get", `conversations/${current}/messages`).expect(404);
    await api(winner, "get", attachment).expect(404);
    await api(0, "put", `${group}/close`).send({ cancel: false }).expect(200);
    await db.block.updateMany({ where: { blockerId: ids[1], blockedId: ids[2] }, data: { deletedAt: new Date() } });
  });

  it("limits First Connections to the saved radius even when ordinary Discover uses its fallback", async () => {
    const viewer = accounts[3]!.id;
    const candidate = accounts[4]!.id;
    await db.userDiscoveryPreference.upsert({
      where: { userId: viewer },
      create: { userId: viewer, maxDistanceKm: 8, intentFilter: ["FRIENDSHIP"], languageFilter: [run] },
      update: { maxDistanceKm: 8, intentFilter: ["FRIENDSHIP"], languageFilter: [run] },
    });
    await db.userIntent.create({ data: { userId: candidate, intent: "FRIENDSHIP" } });
    await db.user.update({ where: { id: candidate }, data: { lastActiveAt: new Date() } });
    await db.userProfile.update({ where: { userId: candidate }, data: { locationLat: 17.54, languages: [run] } });
    await db.profilePhoto.create({ data: {
      userId: candidate, bucket: "profile-photos", objectKey: `social-verification/${run}/profile.jpg`,
      mimeType: "image/jpeg", sizeBytes: 32, moderationStatus: "APPROVED", isPrimary: true,
    } });
    const getFeed = () => api(3, "get", "discovery/feed?limit=8").expect(200);
    const distant = (await getFeed()).body;
    expect(distant.items.map(({ userId }: { userId: string }) => userId)).toEqual([candidate]);
    expect(distant.firstConnectionUserIds).toEqual([]);
    await db.userProfile.update({ where: { userId: candidate }, data: { locationLat: 17.44 } });
    expect((await getFeed()).body.firstConnectionUserIds).toEqual([candidate]);
    await db.userProfile.update({ where: { userId: candidate }, data: { isIncognito: true } });
    const privatePage = (await getFeed()).body;
    expect(privatePage.items).toEqual([]);
    expect(privatePage.firstConnectionUserIds).toEqual([]);
    await db.userProfile.update({ where: { userId: candidate }, data: { isIncognito: false } });
  });

  it("keeps attendance and volunteering separate and enforces state, locality, and association boundaries", async () => {
    const group = await createCircle("Tech meetup");
    const ids = accounts.map(({ id }) => id);
    const story = await protectedStory();
    await api(1, "put", `${group}/membership`).expect(200);
    await decide(group, 1).expect(200);
    const content = { title: "Plan a tech meetup", description: "Find a public place to meet", capacity: 1, openToNearby: false, helpNeeds: ["Design a poster"] };
    const { body } = await api(0, "post", `${group}/activities`).send(content).expect(201);
    const path = `${group}/activities/${body.id}`;
    const attendance = `${path}/responses/0`;
    const volunteer = `${path}/responses/1`;
    await api(2, "put", attendance).expect(404);
    await api(1, "put", volunteer).expect(200);
    await api(0, "put", `${volunteer}/${ids[1]}`).send({ approve: true }).expect(200);
    const activityNotice = { route: "circle-activity", activityId: body.id as string };
    expect(await notices(0, { ...activityNotice, need: 1, status: "PENDING" })).toHaveLength(1);
    expect(await notices(1, { ...activityNotice, need: 1, status: "APPROVED" })).toHaveLength(1);
    expect((await api(1, "get", group).expect(200)).body.activities[0])
      .toMatchObject({ approvedCount: 0, mine: [{ need: 1, status: "APPROVED" }] });
    const { helpNeeds: _helpNeeds, ...mutable } = content;
    await api(0, "put", path).send({ ...mutable, openToNearby: true, version: 1 }).expect(200);
    const profile = { userId: ids[0] };
    await db.userProfile.update({ where: profile, data: { fieldAudiences: { location: "ONLY_ME" } } });
    try {
      expect((await api(0, "get", group).expect(200)).body.locality).toBe("Hyderabad, Telangana");
      expect((await api(1, "get", group).expect(200)).body.locality).toBe("");
      expect((await api(2, "get", group).expect(200)).body.locality).toBe("");
      const nearby = (await api(2, "get", "social/circles?scope=nearby").expect(200)).body.items;
      expect(nearby).toEqual(expect.arrayContaining([expect.objectContaining({
        id: group.split("/").pop(), locality: "", activities: expect.arrayContaining([expect.objectContaining({ id: body.id })]),
      })]));
    } finally {
      await db.userProfile.update({ where: profile, data: { fieldAudiences: {} } });
    }
    await api(0, "put", path).send({ ...mutable, version: 1 }).expect(409);
    expect(await notices(1, { ...activityNotice, status: "UPDATED" })).toHaveLength(1);
    await api(2, "put", volunteer).expect(404);
    await api(2, "put", attendance).expect(200);
    await api(3, "put", attendance).expect(200);
    await api(0, "put", `${attendance}/${ids[3]}`).send({ approve: false }).expect(200);
    await api(3, "delete", attendance).expect(404);
    await api(3, "put", attendance).expect(409);
    await api(0, "put", `${attendance}/${ids[2]}`).send({ approve: true }).expect(200);
    expect(await notices(0, { ...activityNotice, need: 0, status: "PENDING" })).toHaveLength(2);
    expect(await notices(2, { ...activityNotice, need: 0, status: "APPROVED" })).toHaveLength(1);
    expect(await notices(3, { ...activityNotice, need: 0, status: "DECLINED" })).toHaveLength(1);
    expect((await api(2, "get", group).expect(200)).body.activities[0]).toMatchObject({
      state: "FULL", helpNeeds: [], approvedCount: 1, mine: [{ need: 0, status: "APPROVED" }],
    });
    await api(4, "put", attendance).expect(409);
    await api(2, "get", story).expect(404);
    await api(2, "post", "blocks").send({ blockedUserId: ids[0] }).expect(200);
    await api(2, "get", group).expect(404);
    const list = (await api(2, "get", "social/circles").expect(200)).body.items;
    expect(list.find((circle: { id: string }) => circle.id === group.split("/").pop()))
      .toMatchObject({ state: "UNAVAILABLE", intent: null, activities: [{ state: "UNAVAILABLE", mine: [{ need: 0, status: "APPROVED" }] }] });
    await api(2, "delete", attendance).expect(200);
    await api(2, "delete", attendance).expect(200);
    await db.block.updateMany({ where: { blockerId: ids[2], blockedId: ids[0] }, data: { deletedAt: new Date() } });
    await api(4, "put", attendance).expect(200);
    await api(0, "delete", path).expect(200);
    expect(await notices(4, { ...activityNotice, status: "CANCELLED" })).toHaveLength(1);
    expect((await api(4, "get", group).expect(200)).body.activities[0]).toMatchObject({
      state: "CANCELLED", redacted: true, venue: null, description: "", mine: [{ need: 0, status: "PENDING" }],
    });
    await api(0, "put", `${attendance}/${ids[4]}`).send({ approve: true }).expect(409);
    const expired = (await api(0, "post", `${group}/activities`).send({ ...content, openToNearby: true }).expect(201)).body.id;
    await api(4, "put", `${group}/activities/${expired}/responses/0`).expect(200);
    await db.circleActivity.update({ where: { id: expired }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await api(2, "put", `${group}/activities/${expired}/responses/0`).expect(409);
    expect((await api(4, "get", group).expect(200)).body.activities.find((activity: { id: string }) => activity.id === expired))
      .toMatchObject({ state: "EXPIRED", redacted: true, venue: null, mine: [{ need: 0, status: "PENDING" }] });
    const involved = { in: ids as string[] };
    const [matches, likes] = await Promise.all([
      db.match.count({ where: { userLowId: involved, userHighId: involved } }),
      db.like.count({ where: { actorId: involved, targetId: involved } }),
    ]);
    expect([matches, likes]).toEqual([0, 0]);
  });

  it("recovers occupied Circle and activity seats, preserves unaffected people, and keeps private RSVP receipts", async () => {
    const group = await createCircle("Recovery club");
    const circleId = group.split("/").at(-1)!;
    const ids = accounts.map(({ id }) => id);
    for (const index of [1, 2]) {
      await api(index, "put", `${group}/membership`).expect(200);
      await decide(group, index).expect(200);
    }
    const content = { title: "Private receipt title", description: "Private receipt description", capacity: 2, openToNearby: true, helpNeeds: [] };
    const { body } = await api(0, "post", `${group}/activities`).send(content).expect(201);
    const path = `${group}/activities/${body.id}`;
    const attendance = `${path}/responses/0`;
    for (const index of [3, 4, 5]) await api(index, "put", attendance).expect(200);
    for (const index of [3, 4]) await api(0, "put", `${attendance}/${ids[index]}`).send({ approve: true }).expect(200);
    await api(5, "delete", attendance).expect(200);
    await api(0, "post", "blocks").send({ blockedUserId: ids[1] }).expect(200);
    try {
      await db.user.update({ where: { id: ids[3] }, data: { status: "SUSPENDED" } });
      await api(0, "get", group).expect(404);
      const ownerReceipt = (await api(0, "get", "social/circles?scope=own").expect(200)).body.items.find((item: { id: string }) => item.id === circleId);
      expect(ownerReceipt).toMatchObject({ organizer: true, redacted: true, state: "UNAVAILABLE", title: "Unavailable circle" });
      await api(2, "put", `${group}/recovery`).expect(404);
      const recoveries = await Promise.all([0, 1].map(() => api(0, "put", `${group}/recovery`).expect(200)));
      expect(recoveries.map(result => result.body)).toEqual(expect.arrayContaining([{ recovered: true }, { recovered: false }]));
      const after = (await api(0, "get", group).expect(200)).body;
      expect(after.approvedCount).toBe(2);
      expect(after.members.map((member: { userId: string }) => member.userId)).toEqual(expect.arrayContaining([ids[0], ids[2]]));
      expect(after.activities[0]).toMatchObject({ approvedCount: 1, requests: [{ userId: ids[4], status: "APPROVED" }] });
      expect(await db.circleActivityResponse.findMany({ where: { activityId: body.id }, select: { userId: true, status: true } }))
        .toEqual(expect.arrayContaining([{ userId: ids[3], status: "REMOVED" }, { userId: ids[5], status: "WITHDRAWN" }]));

      const { helpNeeds: _helpNeeds, ...mutable } = content;
      await api(0, "put", path).send({ ...mutable, version: 1, openToNearby: false }).expect(200);
      for (const [index, status] of [[4, "REMOVED"], [5, "WITHDRAWN"]] as const) {
        const receipt = (await api(index, "get", group).expect(200)).body;
        expect(receipt).toMatchObject({ chatId: null, members: [], activities: [{
          id: body.id, state: "UNAVAILABLE", redacted: true, venue: null, description: "", helpNeeds: [], mine: [{ need: 0, status }],
        }] });
        expect(JSON.stringify(receipt)).not.toContain(content.title);
      }
      await api(0, "put", `${group}/close`).send({ cancel: false }).expect(200);
      expect((await api(0, "get", group).expect(200)).body).toMatchObject({ state: "CLOSED", chatId: null });
      expect((await api(4, "get", "social/circles?scope=own").expect(200)).body.items.find((item: { id: string }) => item.id === circleId))
        .toMatchObject({ state: "CLOSED", activities: [{ state: "CLOSED", redacted: true, mine: [{ need: 0, status: "REMOVED" }] }] });
    } finally {
      await db.user.update({ where: { id: ids[3] }, data: { status: "ACTIVE" } });
      await db.block.updateMany({ where: { blockerId: ids[0], blockedId: ids[1], deletedAt: null }, data: { deletedAt: new Date() } });
    }
  });

  it("finds older personal items separately and keeps scanning empty nearby pages without repeats", async () => {
    const city = `Pagination ${run.slice(0, 8)}`;
    const ids = accounts.map(({ id }) => id);
    const fixtures = { title: "Nearby club", description: "A test Circle", intent: "FRIENDSHIP" as const, city,
      region: "Telangana", countryCode: "IN", capacity: 4, expiresAt: new Date(Date.now() + 86400000) };
    await db.userProfile.updateMany({ where: { userId: { in: [ids[0]!, ids[2]!, ids[4]!, ids[5]!] } }, data: { city } });
    await db.userProfile.update({ where: { userId: ids[5] }, data: { isIncognito: true } });
    const group = await createCircle("Older pending Circle");
    const personalId = group.split("/").at(-1)!;
    try {
      await api(2, "put", `${group}/membership`).expect(200);
      const createdAt = new Date(Date.now() + 60000);
      const hidden = Array.from({ length: 65 }, () => ({ ...fixtures, id: randomUUID(), organizerId: ids[5]!, createdAt }));
      const visible = Array.from({ length: 33 }, () => ({ ...fixtures, id: randomUUID(), organizerId: ids[4]!, createdAt: new Date(createdAt.getTime() - 1000) }));
      await db.circle.createMany({ data: [...hidden, ...visible] });
      const own = await api(2, "get", "social/circles?scope=own").expect(200);
      expect(own.body.items).toContainEqual(expect.objectContaining({ id: personalId, ownStatus: "PENDING" }));
      const found: string[] = [];
      let cursor: string | null = null;
      for (let index = 0; index < 5; index++) {
        const page: Response = await api(2, "get", "social/circles").query({ scope: "nearby", ...(cursor ? { cursor } : {}) }).expect(200);
        if (index < 2) expect(page.body.items).toEqual([]);
        cursor = page.body.nextCursor;
        found.push(...page.body.items.map((item: { id: string }) => item.id));
        if (!cursor) break;
        if (index === 0) await api(2, "get", "social/circles").query({ scope: "own", cursor }).expect(400);
      }
      expect(cursor).toBeNull();
      expect(found.sort()).toEqual(visible.map(({ id }) => id).sort());
      await api(2, "delete", `${group}/membership`).expect(200);
    } finally {
      await api(0, "put", `${group}/close`).send({ cancel: false }).expect(200);
      await db.userProfile.updateMany({ where: { userId: { in: [ids[0]!, ids[2]!, ids[4]!, ids[5]!] } }, data: { city: "Hyderabad", isIncognito: false } });
    }
  });

  it("hands off a rotating Circle chat, revokes live delivery, and collects unreferenced media", async () => {
    const group = await createCircle("Socket Circle");
    const ids = accounts.map(({ id }) => id);
    const storage = app.get(ObjectStorageService);
    const uploads: InitiateMessageAttachmentUploadResponseDto[] = [];
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("Missing local listener");
    const sockets = accounts.slice(0, 4).map(({ token, sessionId }) => io(`http://127.0.0.1:${address.port}/ws`, {
      autoConnect: false, transports: ["websocket"], auth: { accessToken: token, sessionId },
    }));
    const delivered = sockets.map((socket) => {
      const events: string[] = [];
      socket.on("conversation.message.created", ({ message }) => events.push(message.clientMessageId));
      return events;
    });
    const currentChat = async (): Promise<string> => (await api(0, "get", group).expect(200)).body.chatId;
    const handoff = (index: number, old: string) => api(index, "get", `social/conversations/${old}/current-circle-chat`);
    const message = (index: number, chat: string, clientMessageId: string) => api(index, "post", `conversations/${chat}/messages`)
      .send({ clientMessageId, textBody: "Synthetic Circle message" });
    const data = Buffer.from("Synthetic private attachment");
    const initiate = (conversationId: string) => api(0, "post", "messages/attachments/upload").send({
      conversationId, fileName: "fixture.jpg", mimeType: "image/jpeg", sizeBytes: data.length,
    });
    const upload = async (chat: string) => {
      const { body } = await initiate(chat).expect(200);
      const media: InitiateMessageAttachmentUploadResponseDto = body;
      uploads.push(media);
      const response = await fetch(media.uploadUrl, {
        method: "PUT", headers: media.headers, body: data, signal: AbortSignal.timeout(10000),
      });
      expect(response.ok).toBe(true);
      return media;
    };
    const finalize = (conversationId: string, { uploadToken, objectKey, bucket }: InitiateMessageAttachmentUploadResponseDto, clientMessageId: string) =>
      api(0, "post", "messages/attachments/finalize").send({ conversationId, uploadToken, objectKey, bucket, clientMessageId,
        type: "IMAGE", mimeType: "image/jpeg", sizeBytes: data.length, width: 1, height: 1 });
    const sendAndReceive = async (chat: string, observers: number[]) => {
      const key = randomUUID();
      const events = observers.map(index => nextMessage(sockets[index]!, chat, key));
      const [{ body }, ...received] = await Promise.all([message(0, chat, key).expect(201), ...events] as const);
      for (const event of received) expect(event.message.id).toBe(body.message.id);
      return { key, id: body.message.id as string };
    };
    try {
      for (const index of [1, 2, 3]) {
        await api(index, "put", `${group}/membership`).expect(200);
        await decide(group, index).expect(200);
      }
      await Promise.all(sockets.map(socket => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Circle socket not ready")), 5000);
        socket.once("system.ready", () => { clearTimeout(timer); resolve(); });
        socket.connect();
      })));
      const old = await currentChat();
      const baseline = await sendAndReceive(old, [0, 1, 2, 3]);
      expect((await message(0, old, baseline.key).expect(201)).body.message.id).toBe(baseline.id);
      expect(await notices(2, { route: "circle-message", messageId: baseline.id })).toHaveLength(1);
      expect(await notices(0, { route: "circle-message", messageId: baseline.id })).toHaveLength(0);
      const valid = await upload(old);
      const orphan = await upload(old);
      const uploadKey = randomUUID();
      const media = (await finalize(old, valid, uploadKey).expect(201)).body.message;
      expect((await finalize(old, valid, uploadKey).expect(201)).body.message.id).toBe(media.id);
      await db.message.update({ where: { id: media.id }, data: { attachmentModerationStatus: "APPROVED" } });
      await api(1, "get", `messages/${media.id}/attachment`).expect(200).expect("Cache-Control", "private, no-store");

      const raceKey = randomUUID();
      const [raced] = await Promise.all([message(1, old, raceKey), api(0, "delete", `${group}/members/${ids[1]}`).expect(200)]);
      expect([201, 404]).toContain(raced.status);
      expect(await db.message.count({ where: { conversationId: old, clientMessageId: raceKey } })).toBe(raced.status === 201 ? 1 : 0);
      expect(await db.message.count({ where: { conversationId: old, clientMessageId: baseline.key } })).toBe(1);
      const afterRemoval = await currentChat();
      expect((await handoff(2, old).expect(200)).body).toEqual({ conversationId: afterRemoval });
      await handoff(1, old).expect(404);
      await handoff(4, old).expect(404);
      await api(0, "get", `conversations/${old}/messages`).expect(404);
      const archives = `social/conversations/${afterRemoval}/circle-history`;
      const archivedChat = `conversations/${old}?history=1`;
      const archivedMessages = `conversations/${old}/messages?history=1`;
      const archivedAttachment = `messages/${media.id}/attachment`;
      expect((await api(2, "get", archives).expect(200)).body).toMatchObject({ items: [{ id: old }], nextCursor: null });
      await api(2, "get", archivedChat).expect(200).expect("Cache-Control", "private, no-store");
      expect((await api(2, "get", archivedMessages).expect(200)).body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: baseline.id }), expect.objectContaining({ id: media.id })]),
      );
      await api(2, "get", archivedAttachment).expect(200).expect("Cache-Control", "private, no-store");
      for (const index of [1, 4]) {
        for (const path of [archives, archivedChat, archivedMessages, archivedAttachment]) await api(index, "get", path).expect(404);
      }
      await message(0, old, baseline.key).expect(404);
      await initiate(old).expect(404);
      await finalize(old, valid, uploadKey).expect(404);
      await finalize(old, orphan, randomUUID()).expect(404);
      const removed = await sendAndReceive(afterRemoval, [0, 2, 3]);

      await flag(CIRCLES_FLAG, true, accounts.filter((_, index) => index !== 3));
      await handoff(3, old).expect(404);
      await api(3, "get", archivedMessages).expect(404);
      const disabled = await sendAndReceive(afterRemoval, [0, 2]);
      await flag(CIRCLES_FLAG, true);
      await api(0, "post", "blocks").send({ blockedUserId: ids[2] }).expect(200);
      await api(0, "put", `${group}/recovery`).expect(200);
      await handoff(2, afterRemoval).expect(404);
      await api(0, "get", archivedMessages).expect(404);
      await api(0, "get", archivedAttachment).expect(404);
      const afterBlock = await currentChat();
      const blocked = await sendAndReceive(afterBlock, [0, 3]);

      await db.user.update({ where: { id: ids[3] }, data: { status: "SUSPENDED" } });
      await api(0, "put", `${group}/recovery`).expect(200);
      expect([401, 403, 404]).toContain((await handoff(3, afterBlock)).status);
      const afterSuspension = await currentChat();
      const suspended = await sendAndReceive(afterSuspension, [0]);
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(delivered[1]).not.toContain(removed.key);
      expect(delivered[3]).not.toContain(disabled.key);
      expect(delivered[2]).not.toContain(blocked.key);
      expect(delivered[3]).not.toContain(suspended.key);
      expect(await db.message.count({ where: { conversationId: { in: [afterRemoval, afterBlock, afterSuspension] },
        clientMessageId: { in: [baseline.key, raceKey, uploadKey] } } })).toBe(0);

      const queue = app.get<Queue>(getQueueToken("default"));
      const queued = (await queue.getJobs(["delayed"], 0, 99)).filter(job =>
        job.name === "message.attachment.cleanup" && job.data.conversationId === old,
      );
      expect(queued.map(job => job.data.objectKey).sort()).toEqual([valid.objectKey, orphan.objectKey].sort());
      expect(queued.every(job => job.timestamp + (job.opts.delay ?? 0) > Date.parse(job.data.expiresAt))).toBe(true);
      const cleanup = new MessageAttachmentCleanupProcessor(db, storage);
      await cleanup.process({ ...orphan, conversationId: old }, Date.parse(orphan.expiresAt) - 1);
      await expect(storage.headObject(orphan)).resolves.toMatchObject({ sizeBytes: data.length });
      for (const item of [valid, orphan]) {
        await cleanup.process({ ...item, conversationId: old }, Date.parse(item.expiresAt) + 3600000);
      }
      await expect(storage.headObject(valid)).resolves.toMatchObject({ sizeBytes: data.length });
      await expect(storage.headObject(orphan)).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
      await Promise.all(queued.map(job => job.remove()));
    } finally {
      sockets.forEach(socket => socket.disconnect());
      await flag(CIRCLES_FLAG, true);
      await db.user.update({ where: { id: ids[3] }, data: { status: "ACTIVE" } });
      await db.block.updateMany({ where: { blockerId: ids[0], blockedId: ids[2], deletedAt: null }, data: { deletedAt: new Date() } });
      await api(0, "put", `${group}/close`).send({ cancel: false });
      await Promise.all(uploads.map(item => storage.deleteObject(item)));
    }
  });

  it("grants history only for the latest uninterrupted Circle membership", async () => {
    const group = await createCircle("Circle history");
    const currentChat = async (): Promise<string> => (await api(0, "get", group).expect(200)).body.chatId;
    const join = async (index: number) => {
      await api(index, "put", `${group}/membership`).expect(200);
      await decide(group, index).expect(200);
    };
    const send = (chat: string) => api(0, "post", `conversations/${chat}/messages`).send({
      clientMessageId: randomUUID(), textBody: "Message from an earlier roster",
    }).expect(201);
    const history = (chat: string) => `conversations/${chat}/messages?history=1`;
    await join(1);
    const original = await currentChat();
    await send(original);
    await join(2);
    await api(1, "get", history(original)).expect(200);
    await api(2, "get", history(original)).expect(404);
    await api(1, "delete", `${group}/membership`).expect(200);
    await api(1, "get", history(original)).expect(404);
    await join(1);
    const afterRejoin = await currentChat();
    await api(1, "get", history(original)).expect(404);
    await api(1, "get", `social/conversations/${original}/current-circle-chat`).expect(404);
    expect((await api(1, "get", `social/conversations/${afterRejoin}/circle-history`).expect(200)).body.items).toEqual([]);
    await send(afterRejoin);
    await join(3);
    await api(1, "get", history(afterRejoin)).expect(200);
    expect((await api(1, "get", `social/conversations/${afterRejoin}/circle-history`).expect(200)).body.items)
      .toEqual([expect.objectContaining({ id: afterRejoin })]);
    await api(3, "get", history(afterRejoin)).expect(404);
    await api(0, "put", `${group}/close`).send({ cancel: false }).expect(200);
  });

  it("dispatches generic opt-in push once, rechecks access, and isolates a reused device across accounts", async () => {
    await completeSettingsProfile(0);
    const group = await createCircle("Push club");
    const circleId = group.split("/").at(-1)!;
    const notice = { route: "circle-membership", circleId };
    const token = `social-fcm-${run}`;
    const register = (index: number, value = token) => api(index, "post", "push-tokens")
      .send({ token: value, platform: "ANDROID", provider: "FCM" }).expect(200);
    const notifier = app.get(NotificationDispatchService);
    const dispatch = (id: string) => notifier.execute({ notificationId: id });
    const fcm = jest.spyOn(app.get(FcmPushTransport), "send").mockResolvedValue({
      outcome: "DELIVERED", providerMessageId: "synthetic",
    });
    const requestMembership = (index: number) => api(index, "put", `${group}/membership`).expect(200);
    const queuedRequest = async (index: number) => {
      const fields = { ...notice, status: "PENDING", applicantId: accounts[index]!.id };
      const rows = await notices(0, fields);
      expect(rows).toHaveLength(1);
      const id = rows[0]!.id;
      const job = await app.get<Queue>(getQueueToken("default"))
        .getJob(toBullmqSafeJobId(`notification.dispatch:${id}`));
      expect(job?.data).toEqual({ notificationId: id });
      return id;
    };
    try {
      await register(0);
      await requestMembership(3);
      await requestMembership(3);
      const disabled = await queuedRequest(3);
      await dispatch(disabled);
      expect((await db.notification.findUniqueOrThrow({ where: { id: disabled } })).status).toBe("CANCELED");
      expect(fcm).not.toHaveBeenCalled();

      await api(0, "put", "profiles/me/communication-preference").send({
        allowVoiceCalls: true, allowVideoCalls: true, allowReadReceipts: true,
        allowPushMatches: true, allowPushMessages: true, allowPushCalls: true, allowPushSocial: true,
      }).expect(200);
      await requestMembership(2);
      const enabled = await queuedRequest(2);
      await dispatch(enabled);
      await dispatch(enabled);
      expect(fcm.mock.calls).toEqual([[{
        token, title: "Yariva", body: "You have a new update.",
        data: { route: "social-notification", notificationId: enabled },
      }]]);
      const read = `notifications/${enabled}/read`;
      await api(3, "post", read).expect(404);
      expect((await api(0, "post", read).expect(200)).body.notification).toMatchObject({
        data: notice, actor: null,
      });
      await decide(group, 2).expect(200);
      const approvals = await notices(2, { ...notice, status: "APPROVED" });
      expect(approvals).toHaveLength(1);
      await api(0, "delete", `${group}/members/${accounts[2]!.id}`).expect(200);
      await api(2, "post", `notifications/${approvals[0]!.id}/read`).expect(404);
      await api(0, "post", read).expect(404);

      const newerToken = `social-fcm-newer-${run}`;
      await register(0, newerToken);
      await requestMembership(4);
      const switched = await queuedRequest(4);
      fcm.mockImplementationOnce(async () => {
        await register(3);
        return { outcome: "DELIVERED", providerMessageId: "synthetic" };
      });
      await dispatch(switched);
      expect(fcm).toHaveBeenCalledTimes(2);
      expect(fcm.mock.lastCall?.[0].token).toBe(newerToken);
      await api(3, "post", `notifications/${switched}/read`).expect(404);

      await decide(group, 3, false).expect(200);
      const declines = await notices(3, { ...notice, status: "DECLINED" });
      expect(declines).toHaveLength(1);
      await api(3, "post", `notifications/${declines[0]!.id}/read`).expect(200);
      await api(0, "put", `${group}/close`).send({ cancel: false }).expect(200);
    } finally {
      fcm.mockRestore();
    }
  });

  it("seals unilateral intentions and prompt answers and uses transactional versions", async () => {
    const [userLowId, userHighId] = [accounts[0]!.id, accounts[1]!.id].sort() as [string, string];
    const match = await db.match.create({ data: { userLowId, userHighId, conversation: { create: {} } }, include: { conversation: true } });
    const path = `social/conversations/${match.conversation!.id}/check-in`;
    const story = await protectedStory();
    await api(2, "get", path).expect(404);
    await flag(CHECK_IN_FLAG, true, accounts.slice(0, 1));
    await api(0, "get", path).expect(404);
    await flag(CHECK_IN_FLAG, true);
    await api(0, "put", `${path}/intent`).send({ intent: "DATING", version: 0 }).expect(409);
    const changes = await Promise.all([0, 1].map(index => api(index, "put", `${path}/intent`).send({ intent: "FRIENDSHIP", version: 0 })));
    expect(changes.map(result => result.status).sort()).toEqual([200, 409]);
    const other = changes[0]!.status === 409 ? 0 : 1;
    const checkInNotice = { route: "connection-check-in", conversationId: match.conversation!.id };
    const intentInvites = await notices(other, { ...checkInNotice, kind: "intent-invite", version: 1 });
    expect(intentInvites).toHaveLength(1);
    const invite = await api(other, "post", `notifications/${intentInvites[0]!.id}/read`).expect(200);
    expect(invite.body.notification.data).toEqual(checkInNotice);
    expect((await api(other, "get", path).expect(200)).body.intent).toEqual({ version: 1, mine: null, common: null, pending: true });
    expect((await api(other, "put", `${path}/intent`).send({ intent: "FRIENDSHIP", version: 1 }).expect(200)).body.intent.common).toBe("FRIENDSHIP");
    expect(await notices(1 - other, { ...checkInNotice, kind: "intent-update", version: 2 })).toHaveLength(1);
    await api(other, "put", `${path}/intent`).send({ intent: "SHARED_INTERESTS", version: 2 }).expect(200);
    expect((await api(1 - other, "get", path).expect(200)).body.intent).toEqual({ version: 3, mine: null, common: null, pending: true });
    await api(other, "put", `${path}/intent`).send({ intent: null, version: 3 }).expect(200);
    const intents = `${path}/intent`;
    const firstId = accounts[0]!.id;
    const secondId = accounts[1]!.id;
    await db.userIntent.create({ data: { userId: firstId, intent: "DATING" } });
    expect((await api(0, "put", intents).send({ intent: "DATING", version: 4 }).expect(200)).body.intent)
      .toMatchObject({ mine: "DATING", common: null });
    expect((await api(1, "get", path).expect(200)).body.intent).toMatchObject({ mine: null, common: null, pending: true });
    await db.userIntent.create({ data: { userId: secondId, intent: "DATING" } });
    expect((await api(1, "put", intents).send({ intent: "DATING", version: 5 }).expect(200)).body.intent.common).toBe("DATING");
    const preference = {
      minAge: 18, maxAge: 99, maxDistanceKm: 100, intentFilter: [], preferredGenders: [],
      includeRecentlyActiveOnly: false, preferSameCity: false,
    };
    await db.userProfile.update({ where: { userId: firstId }, data: {
      bio: "A complete synthetic profile for the consent check", locationGeohash: "tek9",
    } });
    await db.userCommunicationPreference.upsert({ where: { userId: firstId }, create: { userId: firstId }, update: {} });
    await db.profilePhoto.create({ data: {
      userId: firstId, bucket: "profile-photos", objectKey: `social-verification/${run}/consent.jpg`,
      mimeType: "image/jpeg", sizeBytes: 32, moderationStatus: "APPROVED", isPrimary: true,
    } });
    const savePreferences = (value: object) => api(0, "put", "profiles/me/discovery-preference").send(value).expect(200);
    await savePreferences({ ...preference, maxDistanceKm: 80, preferSameCity: true });
    expect((await api(0, "get", path).expect(200)).body.intent).toMatchObject({ version: 6, common: "DATING" });
    await savePreferences({ ...preference, preferredGenders: ["MAN"] });
    await savePreferences(preference);
    for (const index of [0, 1]) {
      expect((await api(index, "get", path).expect(200)).body.intent)
        .toEqual({ version: 7, mine: null, common: null, pending: false });
    }
    await api(0, "put", intents).send({ intent: "DATING", version: 6 }).expect(409);
    await api(0, "put", intents).send({ intent: "DATING", version: 7 }).expect(200);
    const agreed = await api(1, "put", intents).send({ intent: "DATING", version: 8 }).expect(200);
    expect(agreed.body.intent.common).toBe("DATING");
    const accountActions = app.get(ApplyAccountActionService);
    await db.$transaction((tx) => accountActions.apply(tx, { userId: secondId, action: "SUSPEND", now: new Date() }));
    await api(0, "get", path).expect(404);
    await db.$transaction((tx) => accountActions.apply(tx, { userId: secondId, action: "RESTORE", now: new Date() }));
    expect((await api(0, "get", path).expect(200)).body.intent).toEqual({ version: 10, mine: null, common: null, pending: false });

    const vibe = `${path}/vibe`;
    await api(0, "put", vibe).send({ action: "START", version: 0 }).expect(200);
    expect(await notices(1, { ...checkInNotice, kind: "vibe-invite", version: 1 })).toHaveLength(1);
    await api(0, "put", vibe).send({ action: "ACCEPT", version: 1 }).expect(409);
    await api(1, "put", vibe).send({ action: "ACCEPT", version: 1 }).expect(200);
    const submissions = [["Read a book", "Bouldering"], ["Bake a cake", "Cycling"]];
    const results = await Promise.all(submissions.map(answers => api(0, "put", vibe).send({ action: "ANSWER", version: 2, answers })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const accepted = results[0]!.status === 200 ? 0 : 1;
    await api(0, "put", vibe).send({ action: "ANSWER", version: 3, answers: submissions[1 - accepted] }).expect(409);
    expect((await api(0, "put", vibe).send({ action: "ANSWER", version: 2, answers: submissions[accepted] }).expect(200)).body.vibe)
      .toMatchObject({ version: 3, mine: submissions[accepted], theirs: [] });
    expect((await api(1, "get", path).expect(200)).body.vibe).toMatchObject({ state: "ANSWER", theirs: [] });
    expect((await api(1, "put", vibe).send({ action: "ANSWER", version: 3, answers: ["Go for a walk", "Drawing"] }).expect(200)).body.vibe)
      .toMatchObject({ state: "SHARED", theirs: submissions[accepted] });
    const completions = await notices(0, { ...checkInNotice, kind: "vibe-complete", version: 4 });
    expect(completions).toHaveLength(1);
    expect((await api(0, "post", `notifications/${completions[0]!.id}/read`).expect(200)).body.notification.data)
      .toEqual(checkInNotice);
    await api(1, "get", story).expect(404);
    await api(0, "put", vibe).send({ action: "SKIP", version: 4 }).expect(200);
    await api(0, "put", vibe).send({ action: "START", version: 5 }).expect(200);
    await api(1, "put", vibe).send({ action: "ACCEPT", version: 6 }).expect(200);
    await api(0, "put", vibe).send({ action: "ANSWER", version: 2, answers: submissions[accepted] }).expect(409);
    expect((await api(1, "get", path).expect(200)).body.vibe).toMatchObject({ state: "ANSWER", mine: [], theirs: [] });
    await api(0, "post", "blocks").send({ blockedUserId: accounts[1]!.id }).expect(200);
    await api(1, "get", path).expect(404);
  });

  it("denies Incognito profile reads with only an incoming like and honors hidden age in the received preview", async () => {
    const target = accounts[4]!.id;
    const viewer = accounts[5]!.id;
    await db.userProfile.update({ where: { userId: target }, data: {
      isIncognito: true, hideAge: true, hideDistance: true, shareWorkDetails: false,
      occupation: "Private occupation", shareSensitiveCompatibility: false, religionSpirituality: "Private beliefs",
    } });
    await api(5, "post", "likes").send({ targetUserId: target }).expect(409);
    await db.like.create({ data: { actorId: viewer, targetId: target } });
    await api(5, "get", `profiles/${target}`).expect(404);
    await db.like.create({ data: { actorId: target, targetId: viewer } });
    const { body: publicView } = await api(5, "get", `profiles/${target}`).expect(200);
    expect(publicView.profile).toMatchObject({ age: null, occupation: null, sensitiveCompatibility: null,
      location: { distanceBand: null, distanceKmRounded: 0 } });
    expect(JSON.stringify(publicView)).not.toMatch(/Private occupation|Private beliefs|dateOfBirth|locationLat|locationLng/);
    const received = await api(5, "get", "likes/received").expect(200);
    expect(received.body.items[0]).toMatchObject({ actorUserId: target, age: null });
  });

  it("enforces dating Scene preferences, preserves social responses, and redacts hidden distance even on a cached page", async () => {
    await flag("scenes.v1", true);
    const [viewer, target, other] = [accounts[2]!.id, accounts[3]!.id, accounts[4]!.id];
    await db.userProfile.update({ where: { userId: other }, data: { isIncognito: false } });
    await db.profilePhoto.create({ data: {
      userId: target, bucket: "profile-photos", objectKey: `social-verification/${run}/scene-profile.jpg`,
      mimeType: "image/jpeg", sizeBytes: 32, moderationStatus: "APPROVED", isPrimary: true,
    } });
    const genders = (userId: string, preferredGenders: Array<"MAN" | "WOMAN">) => db.userDiscoveryPreference.upsert({
      where: { userId }, create: { userId, preferredGenders }, update: { preferredGenders },
    });
    const [ownScene, dating, friendship] = await Promise.all([viewer, target, other].map((ownerId, index) =>
      db.scene.create({ data: { ownerId, lineageId: randomUUID(), intent: index < 2 ? "DATING" : "FRIENDSHIP",
        activity: `Coffee ${run}`, canonicalActivity: `coffee ${run}`, expiresAt: new Date(Date.now() + 3600000) } }),
    ));
    const discover = () => api(2, "get", "scenes/discover?limit=1").expect(200);
    const reply = (sceneId: string, targetUserId = target) => api(2, "post", "likes").send({ sceneId, targetUserId, introNote: "Coffee sounds good" });
    await genders(target, ["MAN"]);
    await reply(dating!.id).expect(404);
    expect((await api(2, "get", "scenes/discover?limit=2").expect(200)).body.items).toEqual([]);
    await genders(target, ["WOMAN"]);
    await genders(viewer, ["WOMAN"]);
    await reply(dating!.id).expect(404);
    await reply(ownScene!.id).expect(404);
    await reply(friendship!.id, other).expect(200);
    await api(5, "post", "likes").send({ targetUserId: target }).expect(200);
    await genders(viewer, ["MAN"]);
    expect((await discover()).body.items[0]).toMatchObject({ scene: { id: dating!.id }, distance: { roundedKm: 0 } });
    await db.userProfile.update({ where: { userId: target }, data: { hideDistance: true } });
    expect((await discover()).body.items[0]).toMatchObject({ scene: { id: dating!.id }, distance: null });
    await reply(dating!.id).expect(200);
    await db.scene.update({ where: { id: dating!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await reply(dating!.id).expect(404);
  });

  it("enforces grouped and individual privacy for saved settings, eligibility, live matches, and like retries", async () => {
    await completeSettingsProfile(4);
    const target = accounts[4]!.id;
    const viewer = accounts[5]!.id;
    const profile = `profiles/${target}`;
    const me = "profiles/me";
    const headline = "Visible after matching";
    const careerPriority = "Private career plans shared with matches";
    await api(4, "patch", me).send({ headline, pronouns: "he/him", careerPriority,
      fieldAudiences: { intro: "MATCHES", location: "ONLY_ME" } }).expect(200);
    await Promise.all([
      api(4, "patch", me).send({ fieldAudiences: { careerPriority: "MATCHES", pronouns: "ONLY_ME" } }).expect(200),
      api(4, "patch", me).send({ fieldAudiences: { religionSpirituality: "ONLY_ME" } }).expect(200),
    ]);
    await api(4, "patch", me).send({ fieldAudiences: { dateOfBirth: "ALL_ELIGIBLE" } }).expect(400);
    const owner = (await api(4, "get", me).expect(200)).body.profile;
    expect(owner).toMatchObject({
      headline, careerPriority, isComplete: true,
      fieldAudiences: {
        age: "ONLY_ME", distance: "ONLY_ME", work: "ONLY_ME", intro: "MATCHES", location: "ONLY_ME",
        pronouns: "ONLY_ME", careerPriority: "MATCHES", religionSpirituality: "ONLY_ME",
      },
    });
    const hidden = { headline: null, age: null, pronouns: null, occupation: null,
      location: { city: null, region: null, countryCode: null, distanceBand: null }, sensitiveCompatibility: null };
    expect((await api(5, "get", profile).expect(200)).body.profile).toMatchObject(hidden);
    const received = (await api(5, "get", "likes/received").expect(200)).body.items;
    expect(received.find((item: { actorUserId: string }) => item.actorUserId === target))
      .toMatchObject({ headline: null, age: null, city: null, region: null });
    const candidate = (await api(3, "get", "discovery/feed?limit=8").expect(200)).body.items
      .find((item: { userId: string }) => item.userId === target);
    expect(candidate).toMatchObject(hidden);

    await db.like.delete({ where: { actorId_targetId: { actorId: viewer, targetId: target } } });
    const like = (targetUserId = target) => api(5, "post", "likes")
      .set("Idempotency-Key", `social-privacy-${run}`).send({ targetUserId });
    const { body } = await like().expect(200);
    const visible = { ...hidden, headline, sensitiveCompatibility: { careerPriority, religionSpirituality: null } };
    expect(body).toMatchObject({ outcome: "MATCH_CREATED", match: { otherUser: visible }, conversation: { otherUser: visible } });
    const match = `matches/${body.match.id}`;
    const conversation = `conversations/${body.conversation.id}`;
    expect((await api(5, "get", profile).expect(200)).body.profile).toMatchObject(visible);
    expect((await api(5, "get", match).expect(200)).body.match.otherUser).toMatchObject(visible);
    expect((await api(5, "get", conversation).expect(200)).body.conversation.otherUser).toMatchObject(visible);
    await api(3, "get", match).expect(404);
    await api(3, "get", conversation).expect(404);
    expect((await api(3, "get", profile).expect(200)).body.profile).toMatchObject(hidden);
    await like(accounts[3]!.id).expect(409);

    await api(4, "patch", me).send({ fieldAudiences: { intro: "ONLY_ME", careerPriority: "ONLY_ME" } }).expect(200);
    expect((await like().expect(200)).body).toMatchObject({
      match: { id: body.match.id, otherUser: hidden }, conversation: { id: body.conversation.id, otherUser: hidden },
    });
    await api(4, "post", "blocks").send({ blockedUserId: viewer }).expect(200);
    await like().expect(409);
  });
});
