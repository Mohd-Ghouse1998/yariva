import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import type { Prisma, EventListing } from "../../src/generated/prisma/client";
import { BullmqProducer } from "../../src/integrations/bullmq/bullmq.producer";
import { EventNoticesService, canReadEventPlanNotice } from "../../src/modules/events/event-notices.service";
import { curateEventData } from "../../src/modules/events/events.policy";
import type { CurateEventDto } from "../../src/modules/events/events.dto";
import type { CurateReviewedVenueDto } from "../../src/modules/date-plans/dto/admin-reviewed-venues.dto";
import { NotificationIntentService } from "../../src/modules/notifications/application/notification-intent.service";
import { PushDispatcherService } from "../../src/modules/notifications/application/notifications.services";
import { FcmPushTransport } from "../../src/modules/notifications/infrastructure/push-transports";

const describeLive = process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
type Account = { id: string; token: string };

describeLive("Events operational gaps (isolated HTTP/PostGIS/notification outbox)", () => {
  let app: NestExpressApplication, prisma: PrismaService, notices: EventNoticesService;
  let admin: Account, first: Account, second: Account, outsider: Account;
  let matchId: string;
  const run = randomUUID().slice(0, 8);
  const city = (suffix: string) => `TEST Operations ${run} ${suffix}`;
  const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
  const api = (actor: Account, method: "get" | "post" | "put", path: string) => request(app.getHttpServer())
    [method](`/api/v1/${path}`).set("Authorization", `Bearer ${actor.token}`).timeout(15000);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    await configureHttpServer(app); await app.init();
    prisma = app.get(PrismaService); notices = app.get(EventNoticesService);
    await prisma.featureFlag.upsert({ where: { key: "events.v1" }, create: { key: "events.v1", enabled: true, scope: "GLOBAL" }, update: { enabled: true, scope: "GLOBAL" } });
    const accounts: Account[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await request(app.getHttpServer()).post("/api/v1/auth/signup").send({
        email: `operations-${run}-${i}@example.com`, password: "StrongPassw0rd!",
        device: { deviceId: `operations-${run}-${i}`, platform: "ANDROID", appVersion: "test" },
      }).expect(201);
      const id: string = response.body.user.id;
      accounts.push({ id, token: response.body.tokens.accessToken });
      await prisma.user.update({ where: { id }, data: { status: "ACTIVE", ...(i === 0 ? { role: "ADMIN" } : {}) } });
      await prisma.userProfile.update({ where: { userId: id }, data: { dateOfBirth: new Date("1995-01-01") } });
    }
    [admin, first, second, outsider] = accounts as [Account, Account, Account, Account];
    const [userLowId, userHighId] = [first.id, second.id].sort() as [string, string];
    matchId = (await prisma.match.create({ data: { userLowId, userHighId, status: "ACTIVE" } })).id;
    // Recover older synthetic fixtures before injecting targeted worker faults.
    await notices.reconcile();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => { await app?.close(); });

  function listing(suffix: string, overrides: Partial<CurateEventDto> = {}): CurateEventDto {
    return { expectedVersion: 0, status: "PUBLISHED", title: `TEST public arts ${randomUUID()}`,
      description: "Synthetic integration fixture, never pilot supply.", category: "CULTURE", city: city(suffix), locality: "Madhapur",
      venueName: "TEST arts centre", venueAddress: "TEST address", startsAt: future(2), endsAt: future(2.1), timezone: "Asia/Kolkata",
      sourceName: "TEST official source", sourceUrl: `https://example.com/${randomUUID()}`, verifiedAt: new Date(Date.now() - 1000).toISOString(), ...overrides };
  }
  async function seedEvent(suffix: string, overrides: Partial<CurateEventDto> = {}, createdAt?: Date) {
    const input = listing(suffix, overrides);
    const event = await prisma.eventListing.create({ data: { ...curateEventData(input), ...(createdAt ? { createdAt } : {}) } });
    return { event, input };
  }
  function venue(suffix: string): CurateReviewedVenueDto {
    return { expectedVersion: 0, name: "TEST reviewed café", address: "TEST address", publicLocality: "Madhapur", city: city(suffix),
      countryCode: "IN", latitude: 17.4, longitude: 78.4, reviewStatus: "REVIEWED", operationalStatus: "OPEN", category: "CAFE",
      reviewSource: "https://example.com/TEST-reviewed-place", reviewedAt: new Date(Date.now() - 1000).toISOString() };
  }
  async function plan(event: EventListing, overrides: Partial<Prisma.DatePlanUncheckedCreateInput> = {}) {
    return prisma.datePlan.create({ data: { matchId, createdByUserId: first.id, eventId: event.id, eventVersion: event.version,
      eventSnapshot: { id: event.id, version: event.version, title: event.title, sourceUrl: event.sourceUrl, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString() },
      status: "PROPOSED", title: event.title, description: event.description, activityType: "EVENT", proposedStartAt: event.startsAt,
      durationMinutes: 120, timezone: event.timezone, publicLocality: event.locality, createdAt: new Date(Date.now() - 1000), ...overrides } });
  }
  const change = (event: EventListing, input: CurateEventDto, overrides: Partial<CurateEventDto> = {}) => api(admin, "put", `admin/events/${event.id}`)
    .send({ ...input, expectedVersion: event.version, title: `TEST revised ${randomUUID()}`, ...overrides });
  const eventNotifications = (eventId: string) => prisma.notification.findMany({ where: { data: { path: ["eventId"], equals: eventId } } });

  it("paginates admin Events in immutable order, scopes cursors and survives schedule edits/new inserts", async () => {
    const createdAt = new Date("2025-01-01T00:00:00Z");
    const events = await Promise.all([seedEvent("pages", {}, createdAt), seedEvent("pages", {}, createdAt), seedEvent("pages", {}, createdAt)]);
    const expected = events.map(row => row.event.id).sort().reverse();
    await api(first, "get", "admin/events").query({ city: city("pages") }).expect(403);
    const one = await api(admin, "get", "admin/events").query({ city: city("pages"), limit: 1 }).expect(200);
    expect(one.headers["cache-control"]).toBe("private, no-store");
    expect(one.body.items.map((row: { id: string }) => row.id)).toEqual(expected.slice(0, 1));
    const edited = events.find(row => row.event.id === expected[1])!;
    await change(edited.event, edited.input, { startsAt: future(1), endsAt: future(1.1) }).expect(200);
    await seedEvent("pages");
    const two = await api(admin, "get", "admin/events").query({ city: city("pages"), limit: 2, cursor: one.body.nextCursor }).expect(200);
    expect(two.body.items.map((row: { id: string }) => row.id)).toEqual(expected.slice(1));
    expect(two.body.nextCursor).toBeNull();
    await api(admin, "get", "admin/events").query({ city: city("other"), cursor: one.body.nextCursor }).expect(400);
    await api(admin, "get", "admin/events").query({ city: city("pages"), cursor: "broken" }).expect(400);
    const badDate = Buffer.from(JSON.stringify({ id: expected[0], scope: `admin-events:${city("pages").toLowerCase()}`, createdAt: "invalid" })).toString("base64url");
    await api(admin, "get", "admin/events").query({ city: city("pages"), cursor: badDate }).expect(400);
  });

  it("requires audited reviewed-place provenance, image rights and honest pricing; applies the existing fallback policy", async () => {
    const id = randomUUID(), input = venue("places");
    await api(first, "put", `admin/reviewed-venues/${id}`).send(input).expect(403);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, reviewSource: null }).expect(400);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, reviewedAt: future(1) }).expect(400);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, photoUrl: "https://example.com/photo.jpg" }).expect(400);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, reviewSource: "https://127.0.0.1/private" }).expect(400);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, priceMinPerPerson: 100 }).expect(400);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, isSynthetic: false, rating: 5 }).expect(400);
    const response = await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, photoUrl: "https://example.com/TEST-photo.jpg", photoRights: "TEST licensed image" }).expect(200);
    expect(response.body.venue).toMatchObject({ id, version: 1, rating: null, priceMinPerPerson: null, priceMaxPerPerson: null });
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "reviewed-venue.curate" } })).toBe(1);
    const fallback = await api(first, "get", "events").query({ city: input.city, area: input.publicLocality, latitude: input.latitude, longitude: input.longitude }).expect(200);
    expect(fallback.body.places).toHaveLength(1);
    expect(fallback.body.places[0]).toMatchObject({ id, photoUrl: "https://example.com/TEST-photo.jpg", distanceKm: 0 });
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, expectedVersion: 1, operationalStatus: "CLOSED" }).expect(200);
    await api(admin, "put", `admin/reviewed-venues/${id}`).send({ ...input, expectedVersion: 1 }).expect(409);
    const closed = await api(first, "get", "events").query({ city: input.city }).expect(200);
    expect(closed.body.places).toEqual([]);
  });

  it("imports places atomically with bounded size/CAS, prevents lost updates and pages all review states", async () => {
    const items = [0, 1, 2].map(() => ({ ...venue("import"), id: randomUUID() }));
    await api(first, "post", "admin/reviewed-venues/import").send({ items }).expect(403);
    await api(admin, "post", "admin/reviewed-venues/import").send({ items: [items[0], items[0]] }).expect(400);
    await api(admin, "post", "admin/reviewed-venues/import").send({ items: Array.from({ length: 21 }, () => ({ ...venue("import"), id: randomUUID() })) }).expect(400);
    await api(admin, "post", "admin/reviewed-venues/import").send({ items }).expect(201);
    const race = await Promise.all([api(admin, "put", `admin/reviewed-venues/${items[0]!.id}`).send({ ...items[0], id: undefined, expectedVersion: 1, reviewStatus: "PENDING" }),
      api(admin, "put", `admin/reviewed-venues/${items[0]!.id}`).send({ ...items[0], id: undefined, expectedVersion: 1, reviewStatus: "REJECTED" })]);
    expect(race.map(row => row.status).sort()).toEqual([200, 409]);
    const rollbackId = "00000000-0000-4000-8000-000000000001";
    const sorted = items.map(row => row.id).sort();
    await api(admin, "post", "admin/reviewed-venues/import").send({ items: [{ ...venue("rollback"), id: rollbackId }, { ...venue("import"), id: sorted.at(-1), expectedVersion: 999 }] }).expect(409);
    expect(await prisma.reviewedVenue.findUnique({ where: { id: rollbackId } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: rollbackId } })).toBe(0);
    const one = await api(admin, "get", "admin/reviewed-venues").query({ city: city("import"), limit: 2 }).expect(200);
    const two = await api(admin, "get", "admin/reviewed-venues").query({ city: city("import"), limit: 2, cursor: one.body.nextCursor }).expect(200);
    expect(new Set([...one.body.items, ...two.body.items].map((row: { id: string }) => row.id)).size).toBe(3);
    expect(two.body.nextCursor).toBeNull();
    await api(admin, "get", "admin/reviewed-venues").query({ city: city("elsewhere"), cursor: one.body.nextCursor }).expect(400);
  });

  it("reports city-scoped supply/freshness, invitation acceptance and listing reports without private identities", async () => {
    const current = await seedEvent("metrics");
    const stale = await seedEvent("metrics");
    await prisma.eventListing.update({ where: { id: stale.event.id }, data: { verifiedAt: new Date(Date.now() - 8 * 86400000) } });
    await seedEvent("metrics", { status: "CANCELLED" }); await seedEvent("metrics", { status: "DRAFT" }); await seedEvent("other-metrics");
    await plan(current.event, { status: "ACCEPTED", acceptedAt: new Date() });
    await plan(current.event);
    await plan(current.event, { status: "CANCELLED", acceptedAt: new Date() });
    await api(first, "post", "reports").send({ targetType: "EVENT_LISTING", targetEventId: current.event.id, reasonCode: "SAFETY_RISK" }).expect(201);
    await api(first, "get", "admin/analytics/events").query({ city: city("metrics") }).expect(403);
    const response = await api(admin, "get", "admin/analytics/events").query({ city: city("metrics"), window: "7d" }).expect(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.catalog).toMatchObject({ total: 4, eligibleUpcoming: 1, publishedUpcoming: 2, staleUpcoming: 1, cancelledNotEnded: 1, staleRate: 0.5, publishedNotEnded: 2, cancellationRate: 1 / 3 });
    expect(response.body.catalog.byLocality).toEqual([expect.objectContaining({ locality: "Madhapur", total: 4 })]);
    expect(response.body.plans).toEqual({ invitations: 3, acceptedEver: 2, confirmedUpcomingCurrentVersion: 1, acceptanceRate: 2 / 3 });
    expect(response.body.reports).toEqual({ total: 1, open: 1, byReason: [{ reason: "SAFETY_RISK", count: 1 }] });
    expect(JSON.stringify(response.body)).not.toMatch(/userId|matchId|saved|latitude|longitude/);
    await change(current.event, current.input).expect(200);
    const edited = await api(admin, "get", "admin/analytics/events").query({ city: city("metrics"), window: "24h" }).expect(200);
    expect(edited.body.plans).toMatchObject({ invitations: 3, acceptedEver: 2, confirmedUpcomingCurrentVersion: 0 });
    const empty = await api(admin, "get", "admin/analytics/events").query({ city: city("no-supply"), window: "30d" }).expect(200);
    expect(empty.body.catalog.staleRate).toBeNull(); expect(empty.body.catalog.cancellationRate).toBeNull(); expect(empty.body.plans.acceptanceRate).toBeNull();
    await api(admin, "get", "admin/analytics/events").query({ city: city("metrics"), window: "forever" }).expect(400);
  });

  it("persists the curation outbox atomically and rolls back the edit if notice persistence fails", async () => {
    const { event, input } = await seedEvent("atomic");
    expect(await prisma.eventChangeNotice.count({ where: { eventId: event.id } })).toBe(0);
    const fault = jest.spyOn(notices, "persistChange").mockRejectedValueOnce(new Error("TEST outbox failure"));
    await change(event, input).expect(500); fault.mockRestore();
    expect((await prisma.eventListing.findUniqueOrThrow({ where: { id: event.id } })).version).toBe(1);
    expect(await prisma.eventChangeNotice.count({ where: { eventId: event.id } })).toBe(0);
    await change(event, input).expect(200);
    expect(await prisma.eventChangeNotice.count({ where: { eventId: event.id, eventVersion: 2, completedAt: null } })).toBe(1);
  });

  it("fans out durable private notices once across pages, rolls back partial pages and tolerates concurrent recovery", async () => {
    await notices.reconcile();
    const { event, input } = await seedEvent("fanout");
    const plans = await Promise.all(Array.from({ length: 52 }, () => plan(event)));
    await plan(event, { status: "DECLINED" });
    await plan(event, { proposedStartAt: new Date(Date.now() - 86400000) });
    await change(event, input).expect(200);
    const intents = app.get(NotificationIntentService), persist = intents.persist.bind(intents);
    let count = 0;
    const fault = jest.spyOn(intents, "persist").mockImplementation(async (tx, data) => {
      if (data.data?.eventId === event.id && ++count === 2) throw new Error("TEST mid-page failure");
      return persist(tx, data);
    });
    await expect(notices.reconcile()).rejects.toThrow("TEST mid-page failure"); fault.mockRestore();
    expect(await eventNotifications(event.id)).toHaveLength(0);
    expect((await prisma.eventChangeNotice.findUniqueOrThrow({ where: { eventId_eventVersion: { eventId: event.id, eventVersion: 2 } } })).afterPlanId).toBeNull();
    await Promise.all([notices.reconcile(), notices.reconcile()]);
    const notifications = await eventNotifications(event.id);
    expect(notifications).toHaveLength(plans.length * 2);
    expect(new Set(notifications.map(row => row.dedupeKey)).size).toBe(plans.length * 2);
    expect(new Set(notifications.map(row => row.userId))).toEqual(new Set([first.id, second.id]));
    expect(notifications.every(row => row.actorUserId === null && row.type === "DATE_CHANGED")).toBe(true);
    expect(JSON.stringify(notifications.map(row => ({ title: row.title, body: row.body, data: row.data })))).not.toContain(event.title);
    const batch = await prisma.eventChangeNotice.findUniqueOrThrow({ where: { eventId_eventVersion: { eventId: event.id, eventVersion: 2 } } });
    expect(batch.completedAt).not.toBeNull();
    await notices.reconcile(); expect(await eventNotifications(event.id)).toHaveLength(plans.length * 2);
  });

  it("recovers committed notification intents after a post-commit dispatch failure", async () => {
    const { event, input } = await seedEvent("recovery"); await plan(event);
    await change(event, input).expect(200);
    const intents = app.get(NotificationIntentService);
    const fault = jest.spyOn(intents, "dispatchPersisted").mockRejectedValueOnce(new Error("TEST process exited after commit"));
    await expect(notices.reconcile()).rejects.toThrow("TEST process exited after commit"); fault.mockRestore();
    const persisted = await eventNotifications(event.id); expect(persisted).toHaveLength(2);
    await prisma.notification.updateMany({ where: { id: { in: persisted.map(row => row.id) } }, data: { createdAt: new Date("1970-01-01T00:00:00Z") } });
    const enqueue = jest.spyOn(app.get(BullmqProducer), "enqueue").mockResolvedValue(undefined);
    await intents.recoverPending(new Date(Date.now() + 61000));
    for (const notification of persisted) expect(enqueue).toHaveBeenCalledWith("notification.dispatch", { notificationId: notification.id }, expect.objectContaining({ retryFinished: true }));
    await notices.reconcile(); expect(await eventNotifications(event.id)).toHaveLength(2);
  });

  it("rechecks participant/adult/block/match authorization at fan-out, inbox/read and every push-device send", async () => {
    const { event, input } = await seedEvent("privacy"); const originalPlan = await plan(event);
    await change(event, input, { status: "CANCELLED" }).expect(200); await notices.reconcile();
    const notifications = await eventNotifications(event.id), own = notifications.find(row => row.userId === first.id)!;
    expect(own.type).toBe("DATE_CANCELLED");
    expect(await canReadEventPlanNotice(prisma, { ...own, userId: outsider.id })).toBe(false);
    await api(outsider, "post", `notifications/${own.id}/read`).expect(404);
    expect((await api(first, "get", "notifications").query({ limit: 50 }).expect(200)).body.items.some((row: { id: string }) => row.id === own.id)).toBe(true);
    await prisma.userProfile.update({ where: { userId: second.id }, data: { dateOfBirth: new Date("2012-01-01") } });
    expect(await canReadEventPlanNotice(prisma, own)).toBe(false);
    await prisma.userProfile.update({ where: { userId: second.id }, data: { dateOfBirth: new Date("1995-01-01") } });
    await prisma.match.update({ where: { id: matchId }, data: { status: "ENDED" } });
    expect(await canReadEventPlanNotice(prisma, own)).toBe(false);
    await prisma.match.update({ where: { id: matchId }, data: { status: "ACTIVE" } });
    await prisma.user.update({ where: { id: second.id }, data: { status: "SUSPENDED" } });
    expect(await canReadEventPlanNotice(prisma, own)).toBe(false);
    await prisma.user.update({ where: { id: second.id }, data: { status: "ACTIVE" } });
    await prisma.pushToken.createMany({ data: [0, 1].map(i => ({ userId: first.id, platform: "ANDROID" as const, provider: "FCM" as const, token: `TEST-${run}-${i}` })) });
    const send = jest.spyOn(app.get(FcmPushTransport), "send").mockImplementation(async () => {
      await prisma.block.create({ data: { blockerId: second.id, blockedId: first.id } });
      return { outcome: "DELIVERED", providerMessageId: "TEST-mocked-transport" };
    });
    expect(await app.get(PushDispatcherService).dispatch(own)).toBe("SUPPRESSED");
    expect(send).toHaveBeenCalledTimes(1); // second device cannot receive revoked activity
    expect((await api(first, "get", "notifications").query({ limit: 50 }).expect(200)).body.items.some((row: { id: string }) => row.id === own.id)).toBe(false);
    await api(first, "post", `notifications/${own.id}/read`).expect(404);
    await prisma.block.updateMany({ where: { blockerId: second.id, blockedId: first.id, deletedAt: null }, data: { deletedAt: new Date() } });
    await prisma.datePlan.update({ where: { id: originalPlan.id }, data: { status: "CANCELLED" } });
    expect(await canReadEventPlanNotice(prisma, own)).toBe(false);
  });

  it("skips superseded changes, new-version invitations and relationships revoked before fan-out", async () => {
    const { event, input } = await seedEvent("superseded"); await plan(event);
    const revised = await change(event, input).expect(200);
    const version2 = await prisma.eventListing.findUniqueOrThrow({ where: { id: event.id } });
    await plan(version2);
    await change(version2, { ...input, title: revised.body.event.title }, { status: "CANCELLED" }).expect(200);
    const version3 = await prisma.eventListing.findUniqueOrThrow({ where: { id: event.id } });
    await plan(version3);
    await notices.reconcile();
    const rows = await eventNotifications(event.id);
    expect(rows).toHaveLength(4); // only the two earlier plan snapshots
    expect(rows.every(row => (row.data as Record<string, unknown>).eventVersion === 3 && row.type === "DATE_CANCELLED")).toBe(true);
    const blocked = await seedEvent("blocked-fanout"); await plan(blocked.event);
    await change(blocked.event, blocked.input).expect(200);
    const block = await prisma.block.create({ data: { blockerId: first.id, blockedId: second.id } });
    await notices.reconcile(); expect(await eventNotifications(blocked.event.id)).toHaveLength(0);
    await prisma.block.update({ where: { id: block.id }, data: { deletedAt: new Date() } });
  });
});
