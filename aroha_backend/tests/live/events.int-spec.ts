import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import type { CurateEventDto } from "../../src/modules/events/events.dto";

const describeLive =
  process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;
type Account = { id: string; token: string };

describeLive(
  "Events catalog, places, private saves and consent (isolated HTTP/PostGIS)",
  () => {
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let admin: Account,
      first: Account,
      second: Account,
      outsider: Account,
      minor: Account;
    const run = randomUUID().slice(0, 8);
    const city = (suffix: string) => `TEST Events ${run} ${suffix}`;
    const future = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString();
    const api = (
      actor: Account,
      method: "get" | "post" | "put" | "delete",
      path: string,
    ) =>
      request(app.getHttpServer())
        [method](`/api/v1/${path}`)
        .set("Authorization", `Bearer ${actor.token}`)
        .timeout(15000);

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication<NestExpressApplication>();
      await configureHttpServer(app);
      await app.init();
      prisma = app.get(PrismaService);
      await prisma.featureFlag.upsert({
        where: { key: "events.v1" },
        create: { key: "events.v1", enabled: true, scope: "GLOBAL" },
        update: { enabled: true, scope: "GLOBAL" },
      });
      const accounts: Account[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post("/api/v1/auth/signup")
          .send({
            email: `events-${run}-${i}@example.com`,
            password: "StrongPassw0rd!",
            device: {
              deviceId: `events-${run}-${i}`,
              platform: "ANDROID",
              appVersion: "test",
            },
          })
          .expect(201);
        const id: string = res.body.user.id;
        accounts.push({ id, token: res.body.tokens.accessToken });
        await prisma.user.update({
          where: { id },
          data: { status: "ACTIVE", ...(i === 0 ? { role: "ADMIN" } : {}) },
        });
        await prisma.userProfile.update({
          where: { userId: id },
          data: {
            dateOfBirth: new Date(i === 4 ? "2012-01-01" : "1995-01-01"),
          },
        });
      }
      [admin, first, second, outsider, minor] = accounts as [
        Account,
        Account,
        Account,
        Account,
        Account,
      ];
    });
    afterAll(async () => {
      await app?.close();
    });

    function listing(
      suffix: string,
      overrides: Partial<CurateEventDto> = {},
    ): CurateEventDto {
      return {
        expectedVersion: 0,
        status: "PUBLISHED",
        title: `TEST public arts ${randomUUID()}`,
        description: "Synthetic integration fixture, never pilot supply.",
        category: "CULTURE",
        city: city(suffix),
        locality: "Madhapur",
        venueName: "TEST public arts centre",
        venueAddress: "TEST Madhapur address",
        startsAt: future(2),
        endsAt: future(2.1),
        timezone: "Asia/Kolkata",
        sourceName: "TEST official source",
        sourceUrl: `https://example.com/events/${randomUUID()}`,
        verifiedAt: new Date(Date.now() - 1000).toISOString(),
        ...overrides,
      };
    }
    async function curate(data: CurateEventDto, id = randomUUID()) {
      const res = await api(admin, "put", `admin/events/${id}`)
        .send(data)
        .expect(200);
      return { id, data, event: res.body.event };
    }
    async function match() {
      const userLowId = first.id < second.id ? first.id : second.id;
      const userHighId = first.id < second.id ? second.id : first.id;
      await prisma.match.upsert({
        where: { userLowId_userHighId: { userLowId, userHighId } },
        create: { userLowId, userHighId, status: "ACTIVE" },
        update: { status: "ACTIVE" },
      });
      return prisma.match.findUniqueOrThrow({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });
    }
    const proposal = (
      event: { id: string; event: { version: number }; data: CurateEventDto },
      key = randomUUID(),
    ) => ({
      eventId: event.id,
      eventVersion: event.event.version,
      idempotencyKey: key,
      title: "Ignored client title",
      description: "Ignored client details",
      activityType: "EVENT",
      proposedStartAt: future(5),
      durationMinutes: 60,
      timezone: "UTC",
      publicLocality: "Ignored locality",
    });

    it("enforces admin curation, schedule/price/image/URL validation and database deduplication", async () => {
      const data = listing("admin");
      await api(first, "put", `admin/events/${randomUUID()}`)
        .send(data)
        .expect(403);
      await api(admin, "put", `admin/events/${randomUUID()}`)
        .send({ ...data, imageUrl: "https://example.com/image.jpg" })
        .expect(400);
      await api(admin, "put", `admin/events/${randomUUID()}`)
        .send({ ...data, sourceUrl: "https://127.0.0.1/private" })
        .expect(400);
      await api(admin, "put", `admin/events/${randomUUID()}`)
        .send({ ...data, priceMinPaise: 100, priceMaxPaise: 0 })
        .expect(400);
      await api(admin, "put", `admin/events/${randomUUID()}`)
        .send({ ...data, endsAt: data.startsAt })
        .expect(400);
      await api(admin, "put", `admin/events/${randomUUID()}`)
        .send({ ...data, latitude: 17 })
        .expect(400);
      const created = await curate(data);
      await api(admin, "put", `admin/events/${randomUUID()}`)
        .send(data)
        .expect(409);
      const edits = await Promise.all(
        ["One", "Two"].map((title) =>
          api(admin, "put", `admin/events/${created.id}`).send({
            ...data,
            title,
            expectedVersion: 1,
          }),
        ),
      );
      expect(edits.map((res) => res.status).sort()).toEqual([200, 409]);
      const draft = await curate(listing("admin", { status: "DRAFT" }));
      await api(first, "get", `events/${draft.id}`).expect(404);
    });

    it("ranks by consented distance, paginates tied times, binds cursors to filters and excludes stale/cancelled/unknown-price listings", async () => {
      const start = future(3),
        end = future(3.1);
      const near = await curate(
        listing("feed", {
          startsAt: start,
          endsAt: end,
          latitude: 17.4,
          longitude: 78.4,
          priceMinPaise: 0,
          priceMaxPaise: 0,
        }),
      );
      await curate(
        listing("feed", {
          startsAt: start,
          endsAt: end,
          latitude: 17.42,
          longitude: 78.4,
          priceMinPaise: 10000,
          priceMaxPaise: 50000,
        }),
      );
      await curate(listing("feed", { latitude: 18, longitude: 78.4 }));
      const stale = await curate(listing("feed"));
      await prisma.eventListing.update({
        where: { id: stale.id },
        data: { verifiedAt: new Date(Date.now() - 8 * 86400000) },
      });
      await curate(listing("feed", { status: "CANCELLED" }));
      const query = {
        city: city("feed"),
        latitude: 17.4,
        longitude: 78.4,
        maxPricePaise: 50000,
        limit: 1,
      };
      const page1 = await api(first, "get", "events").query(query).expect(200);
      expect(page1.headers["cache-control"]).toContain("no-store");
      expect(page1.body.items.map((row: { id: string }) => row.id)).toEqual([
        near.id,
      ]);
      expect(page1.body.items[0].distanceKm).toBe(0);
      expect(page1.body.nextCursor).toBeTruthy();
      const page2 = await api(first, "get", "events")
        .query({ ...query, cursor: page1.body.nextCursor })
        .expect(200);
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items[0].id).not.toBe(near.id);
      expect(page2.body.nextCursor).toBeNull();
      await api(first, "get", "events")
        .query({ ...query, area: "Different", cursor: page1.body.nextCursor })
        .expect(400);
      await api(first, "get", "events")
        .query({ city: city("feed"), latitude: 17 })
        .expect(400);
      const manual = await api(first, "get", "events")
        .query({ city: city("feed"), maxPricePaise: 0 })
        .expect(200);
      expect(manual.body.items.map((row: { id: string }) => row.id)).toEqual([
        near.id,
      ]);
      expect(manual.body.items[0].distanceKm).toBeNull();
      expect(JSON.stringify(manual.body)).not.toMatch(
        /latitude|longitude|imageRights|userId/,
      );
    });

    it("returns only real, fresh reviewed places on a successful empty first discovery query with the same independent constraints", async () => {
      const base = {
        name: `TEST café ${run}`,
        address: "TEST address",
        publicLocality: "Madhapur",
        city: city("places"),
        countryCode: "IN",
        latitude: 17.4,
        longitude: 78.4,
        category: "CAFE" as const,
        reviewStatus: "REVIEWED" as const,
        reviewSource: "https://example.com/venue",
        reviewedAt: new Date(),
        operationalStatus: "UNKNOWN" as const,
        priceMinPerPerson: 100,
        priceMaxPerPerson: 400,
        photoUrl: "https://example.com/TEST-photo.jpg",
        isSynthetic: false,
      };
      const real = await prisma.reviewedVenue.create({ data: base });
      await prisma.reviewedVenue.create({
        data: { ...base, isSynthetic: true },
      });
      await prisma.reviewedVenue.create({
        data: { ...base, city: city("elsewhere") },
      });
      await prisma.reviewedVenue.create({
        data: { ...base, priceMaxPerPerson: null },
      });
      await prisma.reviewedVenue.create({
        data: { ...base, operationalStatus: "CLOSED" },
      });
      await prisma.reviewedVenue.create({
        data: { ...base, reviewedAt: new Date(Date.now() - 31 * 86400000) },
      });
      const query = {
        city: city("places"),
        area: "Madhapur",
        maxPricePaise: 50000,
      };
      const page = await api(first, "get", "events").query(query).expect(200);
      expect(page.body.items).toEqual([]);
      expect(page.body.places[0].photoUrl).toBeNull();
      expect(page.body.places.map((row: { id: string }) => row.id)).toEqual([
        real.id,
      ]);
      expect(page.body.places[0]).toMatchObject({
        distanceKm: null,
        priceMaxPerPerson: 400,
        availability: "UNKNOWN",
      });
      const nearby = await api(first, "get", "events")
        .query({ ...query, latitude: 17.4, longitude: 78.4 })
        .expect(200);
      expect(nearby.body.places[0].distanceKm).toBe(0);
      const wrongArea = await api(first, "get", "events")
        .query({ ...query, area: "Gachibowli" })
        .expect(200);
      expect(wrongArea.body.places).toEqual([]);
      const date = await api(first, "get", "events")
        .query({ ...query, from: future(1), until: future(3) })
        .expect(200);
      expect(date.body.placesStatus).toBe("UNSUPPORTED_FILTERS");
      expect(date.body.places).toEqual([]);
      const category = await api(first, "get", "events")
        .query({ ...query, category: "MUSIC" })
        .expect(200);
      expect(category.body.places).toEqual([]);
      const saved = await api(first, "get", "events")
        .query({ ...query, saved: "true" })
        .expect(200);
      expect(saved.body.placesStatus).toBeNull();
      expect(saved.body.places).toEqual([]);
      await prisma.reviewedVenue.update({
        where: { id: real.id },
        data: { photoRights: "TEST license attestation" },
      });
      const licensed = await api(
        first,
        "get",
        `events/places/${real.id}`,
      ).expect(200);
      expect(licensed.body.place.photoUrl).toBe(
        "https://example.com/TEST-photo.jpg",
      );
    });

    it("keeps saves private, idempotent and removable after cancellation; gates minors and disabled pilots", async () => {
      const event = await curate(listing("saves"));
      const saves = await Promise.all([
        api(first, "post", `events/${event.id}/save`),
        api(first, "post", `events/${event.id}/save`),
      ]);
      expect(saves.map((res) => res.status)).toEqual([201, 201]);
      expect(
        await prisma.savedEvent.count({ where: { eventId: event.id } }),
      ).toBe(1);
      expect(
        (
          await api(second, "get", "events")
            .query({ city: city("saves"), saved: "true" })
            .expect(200)
        ).body.items,
      ).toEqual([]);
      await api(admin, "put", `admin/events/${event.id}`)
        .send({ ...event.data, expectedVersion: 1, status: "CANCELLED" })
        .expect(200);
      expect(
        (
          await api(first, "get", "events")
            .query({ city: city("saves"), saved: "true" })
            .expect(200)
        ).body.items[0],
      ).toMatchObject({ unavailable: true, status: "CANCELLED" });
      await api(first, "post", `events/${event.id}/save`).expect(409);
      await api(first, "delete", `events/${event.id}/save`).expect(200);
      await api(minor, "get", "events")
        .query({ city: city("saves") })
        .expect(404);
      expect(
        (await api(minor, "get", "events/status").expect(200)).body.enabled,
      ).toBe(false);
      await prisma.featureFlag.update({
        where: { key: "events.v1" },
        data: { enabled: false },
      });
      await api(first, "get", "events")
        .query({ city: city("saves") })
        .expect(404);
      await prisma.featureFlag.update({
        where: { key: "events.v1" },
        data: { enabled: true },
      });
    });

    it("uses canonical snapshots, recovers lost-response retries after edits, and requires a new agreement", async () => {
      const connection = await match();
      const event = await curate(listing("invite"));
      const body = proposal(event);
      const sent = await Promise.all([
        api(first, "post", `matches/${connection.id}/date-plans`).send(body),
        api(first, "post", `matches/${connection.id}/date-plans`).send(body),
      ]);
      expect(sent.map((res) => res.status)).toEqual([201, 201]);
      const plan = sent[0]!.body.datePlan;
      expect(sent[1]!.body.datePlan.id).toBe(plan.id);
      expect(plan).toMatchObject({
        title: event.data.title,
        proposedStartAt: event.data.startsAt,
        eventVersion: 1,
        proposalVersion: 1,
      });
      await api(outsider, "post", `matches/${connection.id}/date-plans`)
        .send(body)
        .expect(404);
      await api(outsider, "post", `date-plans/${plan.id}/accept`).expect(404);
      const acceptances = await Promise.all([
        api(second, "post", `date-plans/${plan.id}/accept`),
        api(second, "post", `date-plans/${plan.id}/accept`),
      ]);
      expect(acceptances.map((response) => response.status)).toEqual([
        200, 200,
      ]);
      expect(
        await prisma.datePlanResponse.count({
          where: { datePlanId: plan.id, response: "ACCEPTED" },
        }),
      ).toBe(2);
      const changed = await curate(
        { ...event.data, expectedVersion: 1, title: "TEST revised event" },
        event.id,
      );
      const retry = await api(
        first,
        "post",
        `matches/${connection.id}/date-plans`,
      )
        .send(body)
        .expect(201);
      expect(retry.body.datePlan).toMatchObject({
        id: plan.id,
        eventChanged: true,
        title: event.data.title,
      });
      await api(second, "post", `date-plans/${plan.id}/accept`).expect(409);
      await api(first, "post", `matches/${connection.id}/date-plans`)
        .send({ ...body, idempotencyKey: randomUUID() })
        .expect(409);
      const updated = await api(
        first,
        "post",
        `matches/${connection.id}/date-plans`,
      )
        .send(proposal(changed))
        .expect(201);
      expect(updated.body.datePlan).toMatchObject({
        status: "PROPOSED",
        eventVersion: 2,
      });
      await api(
        second,
        "post",
        `date-plans/${updated.body.datePlan.id}/accept`,
      ).expect(200);
      await curate(
        { ...changed.data, expectedVersion: 2, status: "CANCELLED" },
        event.id,
      );
      const cancelled = await api(
        first,
        "get",
        `date-plans/${updated.body.datePlan.id}`,
      ).expect(200);
      expect(cancelled.body.datePlan).toMatchObject({
        eventChanged: true,
        eventUnavailable: true,
      });
      await api(first, "get", `events/${event.id}`).expect(200);
    });

    it("rechecks blocks and adult eligibility on invitations and acceptance, including idempotent retries", async () => {
      const connection = await match();
      const event = await curate(listing("blocks"));
      const unsafe = await curate(listing("unsafe", { venueName: "TEST pub" }));
      await api(first, "post", `matches/${connection.id}/date-plans`)
        .send(proposal(unsafe))
        .expect(400)
        .expect((response) =>
          expect(response.body.error.code).toBe("DATE_PLAN_UNSAFE_SUGGESTION"),
        );
      const body = proposal(event);
      const res = await api(
        first,
        "post",
        `matches/${connection.id}/date-plans`,
      )
        .send(body)
        .expect(201);
      const block = await prisma.block.create({
        data: { blockerId: second.id, blockedId: first.id },
      });
      await api(first, "post", `matches/${connection.id}/date-plans`)
        .send(body)
        .expect(403);
      await api(
        second,
        "post",
        `date-plans/${res.body.datePlan.id}/accept`,
      ).expect(403);
      await prisma.block.update({
        where: { id: block.id },
        data: { deletedAt: new Date() },
      });
      await prisma.userProfile.update({
        where: { userId: second.id },
        data: { dateOfBirth: new Date("2012-01-01") },
      });
      await api(first, "post", `matches/${connection.id}/date-plans`)
        .send({ ...body, idempotencyKey: randomUUID() })
        .expect(403);
      await prisma.userProfile.update({
        where: { userId: second.id },
        data: { dateOfBirth: new Date("1995-01-01") },
      });
    });

    it("serializes cancellation against invitation acceptance without rewriting an accepted snapshot", async () => {
      const connection = await match();
      const event = await curate(listing("race"));
      const plan = (
        await api(first, "post", `matches/${connection.id}/date-plans`)
          .send(proposal(event))
          .expect(201)
      ).body.datePlan;
      const race = await Promise.all([
        api(admin, "put", `admin/events/${event.id}`).send({
          ...event.data,
          expectedVersion: 1,
          status: "CANCELLED",
        }),
        api(second, "post", `date-plans/${plan.id}/accept`),
      ]);
      expect(race[0]!.status).toBe(200);
      expect([200, 409]).toContain(race[1]!.status);
      const current = (
        await api(first, "get", `date-plans/${plan.id}`).expect(200)
      ).body.datePlan;
      expect(current).toMatchObject({
        eventVersion: 1,
        eventChanged: true,
        eventUnavailable: true,
        title: event.data.title,
      });
      await api(second, "post", `date-plans/${plan.id}/accept`).expect(409);
    });

    it("deduplicates concurrent listing reports into existing moderation without blaming a user", async () => {
      const event = await curate(listing("report"));
      const report = {
        targetType: "EVENT_LISTING",
        targetEventId: event.id,
        reasonCode: "SAFETY_RISK",
      };
      const responses = await Promise.all([
        api(first, "post", "reports").send(report),
        api(first, "post", "reports").send(report),
      ]);
      expect(responses.map((res) => res.status)).toEqual([201, 201]);
      const id = responses[0]!.body.report.id;
      expect(responses[1]!.body.report.id).toBe(id);
      expect(responses[0]!.body.report.reportedUserId).toBeNull();
      expect(
        await prisma.moderationCase.count({ where: { sourceReportId: id } }),
      ).toBe(1);
      const moderation = await prisma.moderationCase.findFirstOrThrow({
        where: { sourceReportId: id },
      });
      expect(moderation).toMatchObject({
        subjectUserId: null,
        priority: "HIGH",
        findings: { targetType: "EVENT_LISTING", targetId: event.id },
      });
      await api(admin, "post", `admin/moderation/cases/${moderation.id}/action`)
        .send({ action: "BAN" })
        .expect(409);
      await api(admin, "post", `admin/moderation/cases/${moderation.id}/action`)
        .send({
          action: "NOTE_ONLY",
          actionNotes: "Review event through admin curation",
        })
        .expect(201);
      expect(
        (
          await prisma.moderationCase.findUniqueOrThrow({
            where: { id: moderation.id },
          })
        ).status,
      ).toBe("ACTIONED");
      await api(first, "post", "reports")
        .send({ ...report, reportedUserId: second.id })
        .expect(400);
      await api(first, "post", "reports")
        .send({
          targetType: "USER",
          targetEventId: event.id,
          reasonCode: "SPAM",
        })
        .expect(400);
    });
  },
);
