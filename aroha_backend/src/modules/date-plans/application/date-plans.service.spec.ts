import { Prisma } from "../../../generated/prisma/client";
import { DatePlanPolicy } from "../domain/date-plans.policy";
import { DatePlansService } from "./date-plans.service";

describe("DatePlansService idempotency", () => {
  const startAt = "2030-08-10T12:00:00.000Z";
  const payload = {
    title: "Book browsing and chai",
    description: "Meet in a public bookstore and continue over chai.",
    activityType: "BOOKSTORE_AND_CHAI",
    proposedStartAt: startAt,
    durationMinutes: 120,
    timezone: "Asia/Kolkata",
    publicLocality: "Jubilee Hills",
    venueName: "A public bookstore",
    venueAddress: "Jubilee Hills, Hyderabad",
    idempotencyKey: "request-1",
  };
  const match = {
    id: "match-1",
    userLowId: "user-1",
    userHighId: "user-2",
    status: "ACTIVE",
    userLow: { status: "ACTIVE", isDiscoveryFrozen: false },
    userHigh: { status: "ACTIVE", isDiscoveryFrozen: false },
  };
  const existing = {
    id: "plan-1",
    matchId: match.id,
    createdByUserId: "user-1",
    reviewedVenueId: null,
    status: "PROPOSED",
    proposalVersion: 1,
    title: payload.title,
    description: payload.description,
    activityType: payload.activityType,
    proposedStartAt: new Date(startAt),
    durationMinutes: payload.durationMinutes,
    timezone: payload.timezone,
    publicLocality: payload.publicLocality,
    venueName: payload.venueName,
    venueAddress: payload.venueAddress,
    latitude: null,
    longitude: null,
    exactVenueVisibleAt: null,
    estimatedCostMin: 300,
    estimatedCostMax: 800,
    currency: "INR",
    acceptedAt: null,
    declinedAt: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: new Date("2026-08-08T10:00:00.000Z"),
    updatedAt: new Date("2026-08-08T10:00:00.000Z"),
    responses: [],
    checkIns: [],
    match,
  };
  const actor = {
    user: { id: "user-1" },
    session: { id: "session-1" },
  };

  const makeService = (repository: Record<string, jest.Mock>, prisma: Record<string, unknown>) =>
    new DatePlansService(
      prisma as any,
      repository as any,
      new DatePlanPolicy(),
      { execute: jest.fn() } as any,
      { write: jest.fn() } as any,
      { write: jest.fn() } as any,
      { enqueue: jest.fn() } as any,
      { warn: jest.fn() } as any,
      { venueSuggestionsEnabled: true, venueRadiusMeters: 12000, maxVenueSuggestions: 3 } as any,
      {} as any,
    );

  it("returns an existing identical request without creating or notifying again", async () => {
    const repository = {
      findMatchContext: jest.fn().mockResolvedValue(match),
      findIdempotent: jest.fn().mockResolvedValue(existing),
    };
    const prisma = { $transaction: jest.fn() };
    const service = makeService(repository, prisma);

    const result = await service.create({ actor: actor as any, matchId: match.id, payload });

    expect(result.datePlan.id).toBe(existing.id);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("recovers the winning proposal after a concurrent unique-key collision", async () => {
    const repository = {
      findMatchContext: jest.fn().mockResolvedValue(match),
      findIdempotent: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
    };
    const conflict = new Prisma.PrismaClientKnownRequestError("unique collision", {
      code: "P2002",
      clientVersion: "test",
    });
    const prisma = { $transaction: jest.fn().mockRejectedValue(conflict) };
    const service = makeService(repository, prisma);

    const result = await service.create({ actor: actor as any, matchId: match.id, payload });

    expect(result.datePlan.id).toBe(existing.id);
    expect(repository.findIdempotent).toHaveBeenCalledTimes(2);
  });

  it("rejects reuse of an idempotency key for a different manual venue", async () => {
    const repository = {
      findMatchContext: jest.fn().mockResolvedValue(match),
      findIdempotent: jest.fn().mockResolvedValue(existing),
    };
    const prisma = { $transaction: jest.fn() };
    const service = makeService(repository, prisma);

    await expect(
      service.create({
        actor: actor as any,
        matchId: match.id,
        payload: { ...payload, venueName: "A different public bookstore" },
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a stale concurrent counter before writing a response for the wrong version", async () => {
    const repository = { findById: jest.fn().mockResolvedValue(existing) };
    const createResponse = jest.fn();
    const tx = {
      datePlan: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      datePlanResponse: { create: createResponse },
    };
    const prisma = { $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)) };
    const service = makeService(repository, prisma);

    await expect(
      service.counter({
        actor: actor as any,
        datePlanId: existing.id,
        payload: { proposedStartAt: "2031-01-02T12:00:00.000Z" },
      }),
    ).rejects.toMatchObject({ code: "DATE_PLAN_VERSION_CONFLICT" });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it("returns compact reviewed venue results without exposing either person's location", async () => {
    const matchWithLocations = {
      ...match,
      userLow: {
        ...match.userLow,
        profile: { locationLat: 17.385, locationLng: 78.4867 },
      },
      userHigh: {
        ...match.userHigh,
        profile: { locationLat: 17.4318, locationLng: 78.4071 },
      },
    };
    const repository = { findMatchContext: jest.fn().mockResolvedValue(matchWithLocations) };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: "venue-1",
          name: "Yariva Test Cafe",
          address: "Madhapur, Hyderabad",
          publicLocality: "Madhapur",
          reviewSource: "Yariva demo review",
          reviewedAt: new Date("2026-09-23T10:00:00.000Z"),
          operationalStatus: "OPEN",
          category: "CAFE",
          priceMaxPerPerson: 700,
          rating: new Prisma.Decimal(4.8),
          ratingCount: 514,
          distanceKm: 2.4,
          accessibilityFacts: ["Step-free entrance"],
          atmosphereTags: ["quiet"],
          isSynthetic: true,
        },
      ]),
    };
    const service = makeService(repository, prisma);

    const result = await service.venueSuggestions("user-1", match.id, {
      category: "CAFE",
      query: "test",
      locationMode: "ME",
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "venue-1",
          category: "CAFE",
          priceTier: "₹₹",
          availability: "OPEN",
          reviewLabel: "Venue details reviewed",
          rating: 4.8,
          ratingCount: 514,
          distanceKm: 2.4,
        }),
      ],
      manualFallbackAvailable: true,
    });
    expect(result.items[0]).not.toHaveProperty("latitude");
    expect(result.items[0]).not.toHaveProperty("longitude");
    expect(result.items[0]).not.toHaveProperty("priceMaxPerPerson");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
