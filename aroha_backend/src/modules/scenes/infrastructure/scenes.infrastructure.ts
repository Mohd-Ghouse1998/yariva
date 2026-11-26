import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { Prisma, type Scene } from "../../../generated/prisma/client";
import { RedisService } from "../../../integrations/redis/redis.service";
import type { SceneIntentValue } from "../dto/scenes.dto";

export interface SceneCandidateRow {
  sceneId: string;
  ownerId: string;
  lineageId: string;
  version: number;
  intent: SceneIntentValue;
  activity: string;
  tags: string[];
  availableFrom: Date | null;
  availableUntil: Date | null;
  expiresAt: Date;
  sceneCreatedAt: Date;
  displayName: string | null;
  headline: string | null;
  city: string | null;
  region: string | null;
  verificationStatus: string;
  scenePhotoId: string | null;
  scenePhotoBucket: string | null;
  scenePhotoObjectKey: string | null;
  scenePhotoWidth: number | null;
  scenePhotoHeight: number | null;
  photoBucket: string | null;
  photoObjectKey: string | null;
  hideDistance: boolean;
  distanceMeters: number;
  availability: "CONFIRMED" | "UNCONFIRMED";
}

@Injectable()
export class SceneRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOwnedById(
    ownerId: string,
    id: string,
    executor: PrismaTransactionalClient = this.prisma,
  ): Promise<Scene | null> {
    return executor.scene.findFirst({ where: { id, ownerId } });
  }

  findActiveByOwner(
    ownerId: string,
    executor: PrismaTransactionalClient = this.prisma,
  ): Promise<Scene | null> {
    return executor.scene.findFirst({
      where: { ownerId, status: "ACTIVE" },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
  }

  findLatestByOwner(
    ownerId: string,
    executor: PrismaTransactionalClient = this.prisma,
  ): Promise<Scene | null> {
    return executor.scene.findFirst({
      where: { ownerId },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    });
  }

  async lockOwner(executor: PrismaTransactionalClient, ownerId: string): Promise<void> {
    await executor.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))`;
  }

  async expireOwned(
    executor: PrismaTransactionalClient,
    ownerId: string,
    now: Date,
  ): Promise<void> {
    await executor.scene.updateMany({
      where: { ownerId, status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED", endedAt: now },
    });
  }

  async replaceActive(
    executor: PrismaTransactionalClient,
    ownerId: string,
    now: Date,
  ): Promise<void> {
    await executor.scene.updateMany({
      where: { ownerId, status: "ACTIVE" },
      data: { status: "REPLACED", endedAt: now },
    });
  }

  create(
    executor: PrismaTransactionalClient,
    data: Prisma.SceneUncheckedCreateInput,
  ): Promise<Scene> {
    return executor.scene.create({ data });
  }

  update(
    executor: PrismaTransactionalClient,
    id: string,
    data: Prisma.SceneUncheckedUpdateInput,
  ): Promise<Scene> {
    return executor.scene.update({ where: { id }, data });
  }

  async loadOwnerEligibility(ownerId: string): Promise<{
    status: string;
    isShadowBanned: boolean;
    isDiscoveryFrozen: boolean;
    profile: {
      isComplete: boolean;
      isHidden: boolean;
      isIncognito: boolean;
      isPaused: boolean;
      dateOfBirth: Date | null;
      gender: string | null;
      locationUpdatedAt: Date | null;
      locationLat: Prisma.Decimal | null;
      locationLng: Prisma.Decimal | null;
    } | null;
    discoveryPreference: {
      minAge: number | null;
      maxAge: number | null;
      preferredGenders: string[];
    } | null;
  } | null> {
    return this.prisma.user.findFirst({
      where: { id: ownerId, deletedAt: null },
      select: {
        status: true,
        isShadowBanned: true,
        isDiscoveryFrozen: true,
        profile: {
          select: {
            isComplete: true,
            isHidden: true,
            isIncognito: true,
            isPaused: true,
            dateOfBirth: true,
            gender: true,
            locationUpdatedAt: true,
            locationLat: true,
            locationLng: true,
          },
        },
        discoveryPreference: {
          select: { minAge: true, maxAge: true, preferredGenders: true },
        },
      },
    }) as Promise<any>;
  }

  async isVisibleToViewer(viewerId: string, targetUserId: string): Promise<boolean> {
    const [target, blockCount] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: targetUserId,
          status: "ACTIVE",
          deletedAt: null,
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          profile: {
            is: {
              deletedAt: null,
              isComplete: true,
              isHidden: false,
              isIncognito: false,
              isPaused: false,
            },
          },
        },
        select: { id: true },
      }),
      this.prisma.block.count({
        where: {
          deletedAt: null,
          OR: [
            { blockerId: viewerId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: viewerId },
          ],
        },
      }),
    ]);
    return Boolean(target) && blockCount === 0;
  }

  async listCandidates(input: {
    viewerId: string;
    viewerScene: Scene;
    now: Date;
    locationFreshAfter: Date;
    radiusMeters: number;
    viewerDateOfBirth: Date;
    viewerGender: string | null;
    viewerMinAge: number | null;
    viewerMaxAge: number | null;
    viewerPreferredGenders: string[];
    limit: number;
    cursor: { distanceMeters: number; createdAt: Date; sceneId: string } | null;
    restrictSceneIds?: string[];
  }): Promise<SceneCandidateRow[]> {
    const tokenArray = input.viewerScene.activityTokens.length
      ? Prisma.sql`ARRAY[${Prisma.join(input.viewerScene.activityTokens)}]::text[]`
      : Prisma.sql`ARRAY[]::text[]`;
    const preferredGenderCondition = input.viewerPreferredGenders.length
      ? Prisma.sql`AND p."gender"::text IN (${Prisma.join(input.viewerPreferredGenders)})`
      : Prisma.empty;
    const viewerGenderCondition = input.viewerGender
      ? Prisma.sql`AND (cardinality(dp."preferredGenders") = 0 OR ${input.viewerGender}::"ProfileGender" = ANY(dp."preferredGenders"))`
      : Prisma.sql`AND cardinality(dp."preferredGenders") = 0`;
    const restrictCondition = input.restrictSceneIds
      ? input.restrictSceneIds.length
        ? Prisma.sql`AND s."id" IN (${Prisma.join(input.restrictSceneIds.map(id => Prisma.sql`${id}::uuid`))})`
        : Prisma.sql`AND FALSE`
      : Prisma.empty;
    const cursorCondition = input.cursor
      ? Prisma.sql`AND (
          c."distanceMeters" > ${input.cursor.distanceMeters}
          OR (c."distanceMeters" = ${input.cursor.distanceMeters} AND c."sceneCreatedAt" < ${input.cursor.createdAt})
          OR (c."distanceMeters" = ${input.cursor.distanceMeters} AND c."sceneCreatedAt" = ${input.cursor.createdAt} AND c."sceneId" > ${input.cursor.sceneId}::uuid)
        )`
      : Prisma.empty;

    const showDistance = Prisma.sql`COALESCE(p."fieldAudiences"->>'distance' = 'ALL_ELIGIBLE', NOT p."hideDistance")`;
    return this.prisma.$queryRaw<SceneCandidateRow[]>(Prisma.sql`
      WITH eligible AS (
        SELECT
          s."id" AS "sceneId",
          s."ownerId",
          s."lineageId",
          s."version",
          s."intent"::text AS "intent",
          s."activity",
          s."tags",
          s."availableFrom",
          s."availableUntil",
          s."expiresAt",
          s."createdAt" AS "sceneCreatedAt",
          p."displayName",
          CASE WHEN COALESCE(p."fieldAudiences"->>'intro', 'ALL_ELIGIBLE') = 'ALL_ELIGIBLE' THEN p."headline" END AS "headline",
          CASE WHEN COALESCE(p."fieldAudiences"->>'location', 'ALL_ELIGIBLE') = 'ALL_ELIGIBLE' THEN p."city" END AS "city",
          CASE WHEN COALESCE(p."fieldAudiences"->>'location', 'ALL_ELIGIBLE') = 'ALL_ELIGIBLE' THEN p."region" END AS "region",
          p."verificationStatus"::text AS "verificationStatus",
          scene_photo."id" AS "scenePhotoId",
          scene_photo."bucket" AS "scenePhotoBucket",
          scene_photo."objectKey" AS "scenePhotoObjectKey",
          scene_photo."width" AS "scenePhotoWidth",
          scene_photo."height" AS "scenePhotoHeight",
          photo."bucket" AS "photoBucket",
          photo."objectKey" AS "photoObjectKey",
          NOT (${showDistance}) AS "hideDistance",
          CASE WHEN NOT (${showDistance}) THEN 2147483647::double precision
            ELSE ROUND(ST_Distance(viewer_profile."locationPoint", p."locationPoint") / 500) * 500
          END AS "distanceMeters",
          CASE
            WHEN s."availableFrom" IS NULL OR s."availableUntil" IS NULL
              OR ${input.viewerScene.availableFrom}::timestamp IS NULL
              OR ${input.viewerScene.availableUntil}::timestamp IS NULL
            THEN 'UNCONFIRMED'
            ELSE 'CONFIRMED'
          END AS "availability"
        FROM "Scene" s
        JOIN "User" u ON u."id" = s."ownerId"
        JOIN "UserProfile" p ON p."userId" = u."id"
        JOIN "UserDiscoveryPreference" dp ON dp."userId" = u."id"
        JOIN "UserProfile" viewer_profile ON viewer_profile."userId" = ${input.viewerId}::uuid
        LEFT JOIN "ProfilePhoto" scene_photo
          ON scene_photo."id" = s."photoId"
          AND scene_photo."userId" = s."ownerId"
          AND scene_photo."moderationStatus" = 'APPROVED'
          AND scene_photo."deletedAt" IS NULL
        LEFT JOIN LATERAL (
          SELECT ph."bucket", ph."objectKey"
          FROM "ProfilePhoto" ph
          WHERE ph."userId" = u."id"
            AND ph."purpose" = 'PROFILE'
            AND ph."moderationStatus" = 'APPROVED'
            AND ph."deletedAt" IS NULL
          ORDER BY ph."isPrimary" DESC, ph."position" ASC, ph."createdAt" ASC
          LIMIT 1
        ) photo ON TRUE
        WHERE s."ownerId" <> ${input.viewerId}::uuid
          AND s."status" = 'ACTIVE'
          AND s."expiresAt" > ${input.now}::timestamp
          AND s."intent" = ${input.viewerScene.intent}::"SceneIntent"
          AND (
            s."canonicalActivity" = ${input.viewerScene.canonicalActivity}
            OR s."activityTokens" && ${tokenArray}
          )
          AND (
            s."availableFrom" IS NULL OR s."availableUntil" IS NULL
            OR ${input.viewerScene.availableFrom}::timestamp IS NULL
            OR ${input.viewerScene.availableUntil}::timestamp IS NULL
            OR (s."availableFrom" < ${input.viewerScene.availableUntil} AND ${input.viewerScene.availableFrom} < s."availableUntil")
          )
          AND u."status" = 'ACTIVE'
          AND u."deletedAt" IS NULL
          AND u."isShadowBanned" = false
          AND u."isDiscoveryFrozen" = false
          AND p."deletedAt" IS NULL
          AND p."isComplete" = true
          AND p."isHidden" = false
          AND p."isIncognito" = false
          AND p."isPaused" = false
          AND p."dateOfBirth" <= (${input.now}::timestamp - INTERVAL '18 years')
          AND p."locationPoint" IS NOT NULL
          AND p."locationUpdatedAt" >= ${input.locationFreshAfter}
          AND viewer_profile."locationPoint" IS NOT NULL
          AND viewer_profile."locationUpdatedAt" >= ${input.locationFreshAfter}
          AND ST_DWithin(viewer_profile."locationPoint", p."locationPoint", ${input.radiusMeters})
          ${input.viewerScene.intent === "DATING" ? Prisma.sql`
            ${preferredGenderCondition}
            ${viewerGenderCondition}
          ` : Prisma.empty}
          AND (${input.viewerMinAge}::integer IS NULL OR date_part('year', age(${input.now}::timestamp, p."dateOfBirth")) >= ${input.viewerMinAge})
          AND (${input.viewerMaxAge}::integer IS NULL OR date_part('year', age(${input.now}::timestamp, p."dateOfBirth")) <= ${input.viewerMaxAge})
          AND (dp."minAge" IS NULL OR date_part('year', age(${input.now}::timestamp, ${input.viewerDateOfBirth}::timestamp)) >= dp."minAge")
          AND (dp."maxAge" IS NULL OR date_part('year', age(${input.now}::timestamp, ${input.viewerDateOfBirth}::timestamp)) <= dp."maxAge")
          AND NOT EXISTS (
            SELECT 1 FROM "Block" b
            WHERE b."deletedAt" IS NULL
              AND ((b."blockerId" = ${input.viewerId}::uuid AND b."blockedId" = u."id")
                OR (b."blockedId" = ${input.viewerId}::uuid AND b."blockerId" = u."id"))
          )
          AND NOT EXISTS (
            SELECT 1 FROM "Match" m
            WHERE m."status" = 'ACTIVE'
              AND ((m."userLowId" = ${input.viewerId}::uuid AND m."userHighId" = u."id")
                OR (m."userHighId" = ${input.viewerId}::uuid AND m."userLowId" = u."id"))
          )
          ${restrictCondition}
      ), c AS (SELECT * FROM eligible)
      SELECT * FROM c
      WHERE TRUE ${cursorCondition}
      ORDER BY c."distanceMeters" ASC, c."sceneCreatedAt" DESC, c."sceneId" ASC
      LIMIT ${input.limit}
    `);
  }
}

export interface CachedScenePage {
  sceneIds: string[];
  nextCursor: string | null;
}

@Injectable()
export class SceneDiscoveryCacheRepository {
  private static readonly GENERATION_KEY = "scenes:generation";

  constructor(private readonly redis: RedisService) {}

  async getGeneration(): Promise<string> {
    return (await this.redis.get(SceneDiscoveryCacheRepository.GENERATION_KEY)) ?? "0";
  }

  async bumpGeneration(): Promise<void> {
    await this.redis.incr(SceneDiscoveryCacheRepository.GENERATION_KEY);
  }

  async get(key: string): Promise<CachedScenePage | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedScenePage;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  async set(key: string, value: CachedScenePage, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  key(input: {
    viewerId: string;
    sceneId: string;
    sceneVersion: number;
    generation: string;
    cursor: string | null;
    limit: number;
  }): string {
    return [
      "scenes:feed:v3",
      input.viewerId,
      input.sceneId,
      input.sceneVersion,
      input.generation,
      input.cursor ?? "start",
      input.limit,
    ].join(":");
  }
}
