import { Inject, Injectable } from "@nestjs/common";
import { ActivityService } from "../../activity/application/activity.service";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import scenesConfig from "../../../config/scenes.config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { Scene } from "../../../generated/prisma/client";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { acceptsDatingPreferences, isEligible, isPublic, socialUser } from "../../social/social-access";
import {
  isSceneActive,
  normalizeSceneActivity,
  normalizeSceneTags,
} from "../domain/scenes.domain";
import type {
  CreateSceneDto,
  SceneCandidateDto,
  SceneCapabilitiesDto,
  SceneDiscoveryPageDto,
  SceneDto,
  UpdateSceneDto,
} from "../dto/scenes.dto";
import {
  SceneDiscoveryCacheRepository,
  type SceneCandidateRow,
  SceneRepository,
} from "../infrastructure/scenes.infrastructure";

interface SceneWindow {
  availableFrom: Date | null;
  availableUntil: Date | null;
}

@Injectable()
export class ScenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SceneRepository,
    private readonly cache: SceneDiscoveryCacheRepository,
    private readonly featureFlags: EvaluateFeatureFlagService,
    private readonly objectStorage: ObjectStorageService,
    @Inject(scenesConfig.KEY)
    private readonly config: ConfigType<typeof scenesConfig>,
    private readonly activity: ActivityService,
  ) {}

  async capabilities(userId: string): Promise<SceneCapabilitiesDto> {
    const evaluation = await this.featureFlags.execute({
      key: "scenes.v1",
      userId,
    });
    return {
      enabled: evaluation.enabled,
      radiusMeters: this.config.radiusMeters,
      lifetimeHours: this.config.lifetimeHours,
    };
  }

  async getMine(userId: string): Promise<{ scene: SceneDto | null }> {
    await this.assertEnabled(userId);
    const now = new Date();
    let expired = false;
    const scene = await this.prisma.$transaction(async (tx) => {
      await this.repository.lockOwner(tx, userId);
      const active = await this.repository.findActiveByOwner(userId, tx);
      if (active && !isSceneActive(active, now)) {
        const updated = await this.repository.update(tx, active.id, {
          status: "EXPIRED",
          endedAt: now,
        });
        expired = true;
        return updated;
      }
      return active ?? this.repository.findLatestByOwner(userId, tx);
    });
    if (expired) await this.bumpCacheGeneration();
    return { scene: scene ? await this.toDto(scene) : null };
  }

  async getForUser(
    viewerId: string,
    targetUserId: string,
  ): Promise<{ scene: SceneDto | null }> {
    await this.assertEnabled(viewerId);
    if (viewerId === targetUserId) return this.getMine(viewerId);
    if (!(await this.repository.isVisibleToViewer(viewerId, targetUserId))) {
      throw new AppException(
        404,
        ERROR_CODES.SCENE_NOT_FOUND,
        "Scene not found",
      );
    }
    const scene = await this.repository.findActiveByOwner(targetUserId);
    if (!scene) return { scene: null };
    const now = new Date();
    if (!isSceneActive(scene, now)) {
      await this.prisma.$transaction((tx) =>
        this.repository.update(tx, scene.id, {
          status: "EXPIRED",
          endedAt: now,
        }),
      );
      await this.bumpCacheGeneration();
      return { scene: null };
    }
    return { scene: await this.toDto(scene, viewerId) };
  }

  async assertResponseAllowed(
    viewerId: string,
    targetId: string,
    sceneId: string,
    db: PrismaTransactionalClient = this.prisma,
  ): Promise<void> {
    await this.assertEnabled(viewerId);
    const blocked = await db.block.count({ where: { deletedAt: null, OR: [
      { blockerId: viewerId, blockedId: targetId }, { blockerId: targetId, blockedId: viewerId },
    ] } });
    const scene = await db.scene.findFirst({
      where: { id: sceneId, ownerId: targetId, status: "ACTIVE", expiresAt: { gt: new Date() } },
      select: { intent: true, owner: { select: socialUser } },
    });
    if (scene && !blocked && isEligible(scene.owner) && isPublic(scene.owner.profile)) {
      if (scene.intent !== "DATING") return;
      const viewer = await db.user.findUnique({ where: { id: viewerId }, select: socialUser });
      if (viewer && isEligible(viewer) && acceptsDatingPreferences(viewer, scene.owner) &&
          acceptsDatingPreferences(scene.owner, viewer)) return;
    }
    throw new AppException(404, ERROR_CODES.SCENE_NOT_FOUND, "Scene not found");
  }

  async create(
    userId: string,
    payload: CreateSceneDto,
  ): Promise<{ scene: SceneDto }> {
    await this.assertEnabled(userId);
    const now = new Date();
    await this.assertOwnerEligible(userId, now);
    const expiresAt = new Date(
      now.getTime() + this.config.lifetimeHours * 60 * 60 * 1000,
    );
    const normalized = normalizeSceneActivity(payload.activity);
    const window = this.parseWindow(payload, expiresAt, now);

    const scene = await this.prisma.$transaction(async (tx) => {
      await this.repository.lockOwner(tx, userId);
      await this.repository.expireOwned(tx, userId, now);
      await this.repository.replaceActive(tx, userId, now);
      await this.assertPhotoSelectable(tx, userId, payload.photoId ?? null);
      const lineageId = randomUUID();
      const created = await this.repository.create(tx, {
        ownerId: userId,
        photoId: payload.photoId ?? null,
        lineageId,
        version: 1,
        intent: payload.intent,
        ...normalized,
        tags: normalizeSceneTags(payload.tags),
        ...window,
        expiresAt,
      });
      await this.activity.recordScene(tx,userId,created.id);
      return created;
    });
    await this.bumpCacheGeneration();
    return { scene: await this.toDto(scene) };
  }

  async update(
    userId: string,
    sceneId: string,
    payload: UpdateSceneDto,
  ): Promise<{ scene: SceneDto }> {
    await this.assertEnabled(userId);
    const now = new Date();
    await this.assertOwnerEligible(userId, now);
    const scene = await this.prisma.$transaction(async (tx) => {
      await this.repository.lockOwner(tx, userId);
      const current = await this.requireOwned(sceneId, userId, tx);
      this.assertActive(current, now);
      const window = this.parseWindow(
        {
          availableFrom:
            payload.availableFrom === undefined
              ? (current.availableFrom?.toISOString() ?? null)
              : payload.availableFrom,
          availableUntil:
            payload.availableUntil === undefined
              ? (current.availableUntil?.toISOString() ?? null)
              : payload.availableUntil,
        },
        current.expiresAt,
        now,
      );
      const activity = payload.activity
        ? normalizeSceneActivity(payload.activity)
        : {
            activity: current.activity,
            canonicalActivity: current.canonicalActivity,
            activityTokens: current.activityTokens,
          };
      if (payload.photoId !== undefined) {
        await this.assertPhotoSelectable(tx, userId, payload.photoId);
      }
      return this.repository.update(tx, current.id, {
        // Editing changes what a future Wingman party would approve. Bumping the
        // version invalidates any consent bound to the earlier Scene contents.
        version: current.version + 1,
        ...(payload.intent ? { intent: payload.intent } : {}),
        ...(payload.photoId !== undefined ? { photoId: payload.photoId } : {}),
        ...activity,
        ...(payload.tags ? { tags: normalizeSceneTags(payload.tags) } : {}),
        ...window,
      });
    });
    await this.bumpCacheGeneration();
    return { scene: await this.toDto(scene) };
  }

  async end(userId: string, sceneId: string): Promise<{ scene: SceneDto }> {
    await this.assertEnabled(userId);
    const now = new Date();
    const scene = await this.prisma.$transaction(async (tx) => {
      await this.repository.lockOwner(tx, userId);
      const current = await this.requireOwned(sceneId, userId, tx);
      this.assertActive(current, now);
      return this.repository.update(tx, current.id, {
        status: "ENDED",
        endedAt: now,
      });
    });
    await this.bumpCacheGeneration();
    return { scene: await this.toDto(scene) };
  }

  async renew(userId: string, sceneId: string): Promise<{ scene: SceneDto }> {
    await this.assertEnabled(userId);
    const now = new Date();
    await this.assertOwnerEligible(userId, now);
    const expiresAt = new Date(
      now.getTime() + this.config.lifetimeHours * 60 * 60 * 1000,
    );
    const scene = await this.prisma.$transaction(async (tx) => {
      await this.repository.lockOwner(tx, userId);
      const source = await this.requireOwned(sceneId, userId, tx);
      await this.repository.expireOwned(tx, userId, now);
      await this.repository.replaceActive(tx, userId, now);
      const renewedPhotoId = source.photoId
        ? await this.findSelectablePhotoId(tx, userId, source.photoId)
        : null;
      const created = await this.repository.create(tx, {
        ownerId: userId,
        photoId: renewedPhotoId,
        lineageId: source.lineageId,
        version: source.version + 1,
        intent: source.intent,
        activity: source.activity,
        canonicalActivity: source.canonicalActivity,
        activityTokens: source.activityTokens,
        tags: source.tags,
        availableFrom: null,
        availableUntil: null,
        expiresAt,
      });
      await this.activity.recordScene(tx,userId,created.id);
      return created;
    });
    await this.bumpCacheGeneration();
    return { scene: await this.toDto(scene) };
  }

  async discover(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<SceneDiscoveryPageDto> {
    await this.assertEnabled(input.userId);
    const now = new Date();
    const viewer = await this.assertOwnerEligible(input.userId, now);
    const viewerScene = await this.repository.findActiveByOwner(input.userId);
    if (!viewerScene || !isSceneActive(viewerScene, now)) {
      if (viewerScene) {
        await this.prisma.$transaction((tx) =>
          this.repository.update(tx, viewerScene.id, {
            status: "EXPIRED",
            endedAt: now,
          }),
        );
        await this.bumpCacheGeneration();
      }
      throw new AppException(
        409,
        ERROR_CODES.SCENE_NOT_AVAILABLE,
        "Post an active Scene before browsing Scene matches",
      );
    }

    const limit = Math.max(1, Math.min(input.limit ?? 10, 20));
    const cursor = decodeCursor(input.cursor);
    const generation = await this.cache.getGeneration();
    const cacheKey = this.cache.key({
      viewerId: input.userId,
      sceneId: viewerScene.id,
      sceneVersion: viewerScene.version,
      generation,
      cursor: input.cursor ?? null,
      limit,
    });
    const cached = await this.cache.get(cacheKey);
    const sharedQuery = {
      viewerId: input.userId,
      viewerScene,
      now,
      locationFreshAfter: new Date(
        now.getTime() - this.config.locationMaxAgeHours * 60 * 60 * 1000,
      ),
      radiusMeters: this.config.radiusMeters,
      viewerDateOfBirth: viewer.profile!.dateOfBirth!,
      viewerGender: viewer.profile!.gender,
      viewerMinAge: viewer.discoveryPreference?.minAge ?? null,
      viewerMaxAge: viewer.discoveryPreference?.maxAge ?? null,
      viewerPreferredGenders:
        viewer.discoveryPreference?.preferredGenders ?? [],
    };

    if (cached) {
      const rows = await this.repository.listCandidates({
        ...sharedQuery,
        limit: Math.max(cached.sceneIds.length, 1),
        cursor: null,
        restrictSceneIds: cached.sceneIds,
      });
      const byId = new Map(rows.map((row) => [row.sceneId, row]));
      const validRows = cached.sceneIds
        .map((id) => byId.get(id))
        .filter((row): row is SceneCandidateRow => Boolean(row));
      const last = validRows.at(-1);
      if (!cached.nextCursor || (last && encodeCursor(last) === cached.nextCursor)) {
        return {
          items: await this.mapCandidates(validRows, input.userId),
          nextCursor: cached.nextCursor,
        };
      }
    }

    const rows = await this.repository.listCandidates({
      ...sharedQuery,
      limit: limit + 1,
      cursor,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(last) : null;
    await this.cache.set(
      cacheKey,
      { sceneIds: page.map((row) => row.sceneId), nextCursor },
      this.config.discoveryCacheSeconds,
    );
    return { items: await this.mapCandidates(page, input.userId), nextCursor };
  }

  private async assertEnabled(userId: string): Promise<void> {
    const flag = await this.featureFlags.execute({ key: "scenes.v1", userId });
    if (!flag.enabled) {
      throw new AppException(
        404,
        ERROR_CODES.SCENE_NOT_AVAILABLE,
        "Scenes are not available",
      );
    }
  }

  private async assertOwnerEligible(userId: string, now: Date) {
    const owner = await this.repository.loadOwnerEligibility(userId);
    const profile = owner?.profile;
    const adultCutoff = new Date(now);
    adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
    const locationCutoff = new Date(
      now.getTime() - this.config.locationMaxAgeHours * 60 * 60 * 1000,
    );
    if (
      !owner ||
      owner.status !== "ACTIVE" ||
      owner.isShadowBanned ||
      owner.isDiscoveryFrozen ||
      !profile ||
      !profile.isComplete ||
      profile.isHidden ||
      profile.isIncognito ||
      profile.isPaused ||
      !profile.dateOfBirth ||
      profile.dateOfBirth > adultCutoff
    ) {
      throw new AppException(
        403,
        ERROR_CODES.SCENE_NOT_AVAILABLE,
        "Scenes are unavailable for this profile state",
      );
    }
    if (
      profile.locationLat === null ||
      profile.locationLng === null ||
      !profile.locationUpdatedAt ||
      profile.locationUpdatedAt < locationCutoff
    ) {
      throw new AppException(
        409,
        ERROR_CODES.SCENE_LOCATION_REQUIRED,
        "Update your location before using Scenes",
      );
    }
    return owner;
  }

  private async requireOwned(
    sceneId: string,
    userId: string,
    executor: Parameters<SceneRepository["findOwnedById"]>[2],
  ): Promise<Scene> {
    const scene = await this.repository.findOwnedById(
      userId,
      sceneId,
      executor,
    );
    if (!scene) {
      throw new AppException(
        404,
        ERROR_CODES.SCENE_NOT_FOUND,
        "Scene not found",
      );
    }
    return scene;
  }

  private assertActive(scene: Scene, now: Date): void {
    if (!isSceneActive(scene, now)) {
      throw new AppException(
        409,
        ERROR_CODES.SCENE_EXPIRED,
        "This Scene is no longer active",
      );
    }
  }

  private parseWindow(
    payload: { availableFrom?: string | null; availableUntil?: string | null },
    expiresAt: Date,
    now: Date,
  ): SceneWindow {
    const availableFrom = payload.availableFrom
      ? new Date(payload.availableFrom)
      : null;
    const availableUntil = payload.availableUntil
      ? new Date(payload.availableUntil)
      : null;
    const invalid =
      (availableFrom && availableFrom >= expiresAt) ||
      (availableUntil &&
        (availableUntil <= now || availableUntil > expiresAt)) ||
      (availableFrom && availableUntil && availableFrom >= availableUntil);
    if (invalid) {
      throw new AppException(
        400,
        ERROR_CODES.SCENE_INVALID_WINDOW,
        "Availability must be ordered and fall inside the Scene lifetime",
      );
    }
    return { availableFrom, availableUntil };
  }

  private async mapCandidates(
    rows: SceneCandidateRow[],
    viewerId: string,
  ): Promise<SceneCandidateDto[]> {
    return Promise.all(
      rows.map(async (row) => ({
        scene: {
          id: row.sceneId,
          ownerId: row.ownerId,
          lineageId: row.lineageId,
          version: row.version,
          intent: row.intent,
          activity: row.activity,
          photo:
            row.scenePhotoBucket && row.scenePhotoObjectKey && row.scenePhotoId
              ? {
                  id: row.scenePhotoId,
                  url: await this.objectStorage.createPresignedGetObject({
                    disclosure: { viewerId, ownerId: row.ownerId },
                    bucket: row.scenePhotoBucket,
                    objectKey: row.scenePhotoObjectKey,
                  }),
                  width: row.scenePhotoWidth,
                  height: row.scenePhotoHeight,
                }
              : null,
          tags: row.tags,
          availableFrom: row.availableFrom?.toISOString() ?? null,
          availableUntil: row.availableUntil?.toISOString() ?? null,
          expiresAt: row.expiresAt.toISOString(),
          status: "ACTIVE" as const,
          createdAt: row.sceneCreatedAt.toISOString(),
        },
        profile: {
          userId: row.ownerId,
          displayName: row.displayName?.trim() || "Yariva member",
          headline: row.headline,
          city: row.city,
          region: row.region,
          verificationStatus: row.verificationStatus,
          photoUrl:
            row.photoBucket && row.photoObjectKey
              ? await this.objectStorage.createPresignedGetObject({
                  disclosure: { viewerId, ownerId: row.ownerId },
                  bucket: row.photoBucket,
                  objectKey: row.photoObjectKey,
                })
              : null,
        },
        distance: row.hideDistance ? null : distanceSummary(row.distanceMeters),
        availability: row.availability,
      })),
    );
  }

  private async bumpCacheGeneration(): Promise<void> {
    await this.cache.bumpGeneration().catch(() => undefined);
  }

  private async assertPhotoSelectable(
    executor: PrismaTransactionalClient,
    userId: string,
    photoId: string | null,
  ): Promise<void> {
    if (!photoId) return;
    if (!(await this.findSelectablePhotoId(executor, userId, photoId))) {
      throw new AppException(
        400,
        ERROR_CODES.SCENE_INVALID_PHOTO,
        "Choose one of your approved photos",
      );
    }
  }

  private async findSelectablePhotoId(
    executor: PrismaTransactionalClient,
    userId: string,
    photoId: string,
  ): Promise<string | null> {
    const photo = await executor.profilePhoto.findFirst({
      where: {
        id: photoId,
        userId,
        moderationStatus: "APPROVED",
        deletedAt: null,
      },
      select: { id: true },
    });
    return photo?.id ?? null;
  }

  private async toDto(scene: Scene, viewerId = scene.ownerId): Promise<SceneDto> {
    const photo = scene.photoId
      ? await this.prisma.profilePhoto.findFirst({
          where: {
            id: scene.photoId,
            userId: scene.ownerId,
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
          select: {
            id: true,
            bucket: true,
            objectKey: true,
            width: true,
            height: true,
          },
        })
      : null;
    return mapScene(
      scene,
      photo
        ? {
            id: photo.id,
            url: await this.objectStorage.createPresignedGetObject({
              disclosure: { viewerId, ownerId: scene.ownerId },
              bucket: photo.bucket,
              objectKey: photo.objectKey,
            }),
            width: photo.width,
            height: photo.height,
          }
        : null,
    );
  }
}

export function mapScene(
  scene: Scene,
  photo: SceneDto["photo"] = null,
): SceneDto {
  return {
    id: scene.id,
    ownerId: scene.ownerId,
    lineageId: scene.lineageId,
    version: scene.version,
    intent: scene.intent,
    activity: scene.activity,
    photo,
    tags: scene.tags,
    availableFrom: scene.availableFrom?.toISOString() ?? null,
    availableUntil: scene.availableUntil?.toISOString() ?? null,
    expiresAt: scene.expiresAt.toISOString(),
    status: scene.status,
    createdAt: scene.createdAt.toISOString(),
  };
}

function distanceSummary(
  distanceMeters: number,
): NonNullable<SceneCandidateDto["distance"]> {
  const roundedKm = Math.round((distanceMeters / 1000) * 2) / 2;
  return {
    roundedKm,
    band:
      distanceMeters <= 5_000
        ? "LOCAL"
        : distanceMeters <= 10_000
          ? "NEARBY"
          : "FARTHER",
  };
}

interface SceneCursor {
  distanceMeters: number;
  createdAt: Date;
  sceneId: string;
}

function encodeCursor({ distanceMeters, sceneCreatedAt, sceneId }: SceneCandidateRow): string {
  return Buffer.from(JSON.stringify({ distanceMeters, createdAt: sceneCreatedAt.toISOString(), sceneId })).toString("base64url");
}

function decodeCursor(value?: string): SceneCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as {
      distanceMeters?: unknown;
      createdAt?: unknown;
      sceneId?: unknown;
    };
    const createdAt = new Date(String(parsed.createdAt));
    if (
      typeof parsed.distanceMeters !== "number" ||
      !Number.isFinite(parsed.distanceMeters) ||
      Number.isNaN(createdAt.getTime()) ||
      typeof parsed.sceneId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(parsed.sceneId)
    ) {
      throw new Error("invalid");
    }
    return {
      distanceMeters: parsed.distanceMeters,
      createdAt,
      sceneId: parsed.sceneId,
    };
  } catch {
    throw new AppException(
      400,
      ERROR_CODES.INVALID_CURSOR,
      "Invalid Scene cursor",
    );
  }
}
