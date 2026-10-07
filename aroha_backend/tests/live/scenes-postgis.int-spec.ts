import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";

const describeLive =
  process.env.AROHA_RUN_LIVE_INTEGRATION === "1" ? describe : describe.skip;

describeLive("Scene PostGIS migration contracts", () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const ownerId = randomUUID();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has PostGIS, uses longitude-first points, and enforces inclusive 15km", async () => {
    const extension = await prisma.$queryRaw<Array<{ installed: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed
    `;
    expect(extension[0]?.installed).toBe(true);

    await prisma.user.create({
      data: { id: ownerId, email: `postgis-${ownerId}@example.com`, passwordHash: "test" },
    });
    await prisma.userProfile.create({
      data: {
        userId: ownerId,
        displayName: "PostGIS test",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        locationLat: 17.385,
        locationLng: 78.4867,
        locationUpdatedAt: new Date(),
      },
    });
    const point = await prisma.$queryRaw<Array<{ lng: number; lat: number }>>`
      SELECT ST_X("locationPoint"::geometry)::double precision AS lng,
             ST_Y("locationPoint"::geometry)::double precision AS lat
      FROM "UserProfile" WHERE "userId" = ${ownerId}::uuid
    `;
    expect(point[0]).toEqual({ lng: 78.4867, lat: 17.385 });

    const boundary = await prisma.$queryRaw<
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
    expect(boundary[0]).toEqual({ at149: true, at150: true, at151: false });
  });

  it("allows only one active Scene under concurrent inserts", async () => {
    const create = (lineageId: string) =>
      prisma.scene.create({
        data: {
          ownerId,
          lineageId,
          intent: "DATING",
          activity: "Coffee",
          canonicalActivity: "coffee",
          activityTokens: ["coffee"],
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    const results = await Promise.allSettled([create(randomUUID()), create(randomUUID())]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.scene.count({ where: { ownerId, status: "ACTIVE" } })).resolves.toBe(1);
  });
});
