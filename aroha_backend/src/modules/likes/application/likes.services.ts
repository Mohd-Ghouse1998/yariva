import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { canViewProfileField } from "../../profiles/domain/profile-field-audience";
import { UserReaderService } from "../../users/application/users.services";
import { UserRepository } from "../../users/infrastructure/users.infrastructure";
import { InvalidateDiscoverySnapshotService } from "../../discovery/application/discovery.services";
import { ConversationReaderService } from "../../conversations/application/conversations.services";
import { MATCH_EVENTS } from "../../matches/events/matches.events";
import { ScenesService } from "../../scenes/application/scenes.services";
import {
  CreateMatchArtifactsService,
  MatchReaderService,
} from "../../matches/application/matches.services";
import type {
  CreateLikeDto,
  CreateLikeResponseDto,
  LikeDto,
  PassDto,
  ReceivedLikePreviewDto,
  ReceivedLikesResponseDto,
} from "../dto/likes.dto";
import { LikePolicyService, PassPolicyService } from "../domain/likes.domain";
import { LIKE_EVENTS } from "../events/likes.events";
import {
  LikeIdempotencyRepository,
  LikeInteractionRepository,
  LikeRepository,
  PassRepository,
} from "../infrastructure/likes.infrastructure";

const PASS_TTL_DAYS = 14;
const SERIALIZABLE_RETRY_ATTEMPTS = 3;
type CachedLikeReceipt = { like: LikeDto; match: { id: string } | null };

export interface LikeActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class LikeReaderService {
  mapLike(like: {
    id: string;
    actorId: string;
    targetId: string;
    introNote: string | null;
    status: "ACTIVE" | "MATCHED" | "RETRACTED";
    matchedAt: Date | null;
    retractedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): LikeDto {
    return {
      id: like.id,
      actorId: like.actorId,
      targetId: like.targetId,
      introNote: like.introNote,
      status: like.status,
      matchedAt: like.matchedAt?.toISOString() ?? null,
      retractedAt: like.retractedAt?.toISOString() ?? null,
      createdAt: like.createdAt.toISOString(),
      updatedAt: like.updatedAt.toISOString(),
    };
  }
}

// Lists incoming "ACTIVE" likes for the viewer (Likes tab on the client).
// Cursor is the createdAt of the last seen row, base64-encoded so the
// frontend can pass it back opaquely.
@Injectable()
export class GetLikesReceivedService {
  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<ReceivedLikesResponseDto> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
    const cursorDate = input.cursor ? parseCursor(input.cursor) : null;

    const rows = await this.likeRepository.findReceivedLikes({
      targetUserId: input.userId,
      cursor: cursorDate,
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;

    const eligibleRows = visible.filter(
      (row) =>
        row.actor.profile &&
        !row.actor.isDiscoveryFrozen &&
        !row.actor.profile.deletedAt &&
        !row.actor.profile.isHidden &&
        row.actor.profile.isComplete,
    );
    const items: ReceivedLikePreviewDto[] = await Promise.all(
      eligibleRows.map(async (row) => {
        const profile = row.actor.profile!;
        const primaryPhoto = row.actor.photos[0] ?? null;
        const activeMatch = !!(row.actor.matchesLow?.length || row.actor.matchesHigh?.length);
        const showLocation = canViewProfileField(profile, "location", activeMatch);
        return {
          likeId: row.id,
          actorUserId: row.actorId,
          likedAt: row.createdAt.toISOString(),
          introNote: row.introNote,
          displayName: profile.displayName ?? "Someone",
          headline: canViewProfileField(profile, "intro", activeMatch) ? profile.headline ?? null : null,
          age: canViewProfileField(profile, "age", activeMatch) && profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : null,
          intents: row.actor.intents.map(
            (i) => i.intent as ReceivedLikePreviewDto["intents"][number],
          ),
          primaryPhotoUrl: primaryPhoto
            ? await this.objectStorageService.createPresignedGetObject({
                disclosure: { viewerId: input.userId, ownerId: row.actorId },
                bucket: primaryPhoto.bucket,
                objectKey: primaryPhoto.objectKey,
              })
            : null,
          city: showLocation ? profile.city ?? null : null,
          region: showLocation ? profile.region ?? null : null,
        };
      }),
    );

    const last = visible[visible.length - 1];
    const nextCursor = hasMore && last ? buildCursor(last.createdAt) : null;

    return { items, nextCursor };
  }
}

function buildCursor(date: Date): string {
  return Buffer.from(date.toISOString(), "utf8").toString("base64url");
}

function parseCursor(cursor: string): Date | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const date = new Date(decoded);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDifference = today.getUTCDate() - dateOfBirth.getUTCDate();
  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }
  return age;
}

@Injectable()
export class CreateLikeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userRepository: UserRepository,
    private readonly likePolicyService: LikePolicyService,
    private readonly likeRepository: LikeRepository,
    private readonly likeInteractionRepository: LikeInteractionRepository,
    private readonly createMatchArtifactsService: CreateMatchArtifactsService,
    private readonly matchReaderService: MatchReaderService,
    private readonly conversationReaderService: ConversationReaderService,
    private readonly likeReaderService: LikeReaderService,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly bullmqProducer: BullmqProducer,
    private readonly likeIdempotencyRepository: LikeIdempotencyRepository,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
    private readonly scenes: ScenesService,
  ) {}

  async execute(input: {
    userId: string;
    payload: CreateLikeDto;
    metadata: LikeActionMetadata;
    idempotencyKey?: string;
  }): Promise<CreateLikeResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.likePolicyService.assertCanLike(
      input.userId,
      input.payload.targetUserId,
    );

    const idempotencyKey = input.payload.sceneId ? undefined : input.idempotencyKey;
    let cached: CachedLikeReceipt | null = null;
    if (input.payload.sceneId) {
      await this.scenes.assertResponseAllowed(input.userId, input.payload.targetUserId, input.payload.sceneId);
    } else if (idempotencyKey) {
      cached =
        await this.likeIdempotencyRepository.get<CachedLikeReceipt>(
          input.userId,
          idempotencyKey,
        );
      if (cached && cached.like.targetId !== input.payload.targetUserId) {
        throw new AppException(409, ERROR_CODES.IDEMPOTENCY_CONFLICT, "Like request already used for another profile");
      }
    }

    const target = await this.likeInteractionRepository.findLikeTarget(
      input.payload.targetUserId,
    );
    this.likePolicyService.assertTargetEligible(target);

    const hasHistoricalMatch =
      !cached?.match && await this.likeInteractionRepository.hasHistoricalMatchBetween(
        input.userId,
        input.payload.targetUserId,
      );
    if (hasHistoricalMatch) {
      throw new AppException(
        409,
        ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
        "Target cannot currently be interacted with",
      );
    }

    const blocked = await this.likeInteractionRepository.hasActiveBlockBetween(
      input.userId,
      input.payload.targetUserId,
    );
    this.likePolicyService.assertNotBlocked(blocked);
    if (cached) {
      return cached.match
        ? this.buildMatchedResponse(cached.like, input.userId, input.payload.targetUserId, cached.match.id)
        : { outcome: "LIKE_RECORDED", like: cached.like, match: null, conversation: null };
    }

    const existingLike = await this.likeRepository.findByActorAndTarget(
      input.userId,
      input.payload.targetUserId,
    );
    if (existingLike?.status === "MATCHED") {
      const response = await this.buildMatchedResponse(
        this.likeReaderService.mapLike(existingLike),
        input.userId,
        input.payload.targetUserId,
      );
      await this.persistIdempotentResponse(
        input.userId,
        idempotencyKey,
        response,
      );
      return response;
    }
    if (existingLike?.status === "ACTIVE") {
      const response: CreateLikeResponseDto = {
        outcome: "LIKE_RECORDED",
        like: this.likeReaderService.mapLike(existingLike),
        match: null,
        conversation: null,
      };
      await this.persistIdempotentResponse(
        input.userId,
        idempotencyKey,
        response,
      );
      return response;
    }

    const now = new Date();
    const introNote = normalizeIntroNote(input.payload.introNote);
    const transactionResult = await withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          if (input.payload.sceneId) {
            await this.scenes.assertResponseAllowed(input.userId, input.payload.targetUserId, input.payload.sceneId, tx);
          }
          const txBlocked =
            await this.likeInteractionRepository.hasActiveBlockBetween(
              input.userId,
              input.payload.targetUserId,
              tx,
            );
          this.likePolicyService.assertNotBlocked(txBlocked);

          const targetInsideTx = await tx.user.findFirst({
            where: {
              id: input.payload.targetUserId,
            },
            select: {
              id: true,
              status: true,
              deletedAt: true,
              isShadowBanned: true,
              isDiscoveryFrozen: true,
              profile: {
                select: {
                  isHidden: true,
                  isIncognito: true,
                  isPaused: true,
                  isComplete: true,
                  deletedAt: true,
                },
              },
              photos: {
                where: {
                  deletedAt: null,
                  purpose: "PROFILE",
                  moderationStatus: "APPROVED",
                },
                select: {
                  id: true,
                },
                take: 1,
              },
            },
          });
          this.likePolicyService.assertTargetEligible(targetInsideTx);
          if (targetInsideTx.profile?.isIncognito || targetInsideTx.profile?.isPaused) {
            const invitation = await this.likeRepository.findByActorAndTarget(
              input.payload.targetUserId, input.userId, tx,
            );
            if (invitation?.status !== "ACTIVE") {
              throw new AppException(409, ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
                "Target cannot currently be interacted with");
            }
          }

          const historicalMatch =
            await this.likeInteractionRepository.hasHistoricalMatchBetween(
              input.userId,
              input.payload.targetUserId,
              tx,
            );
          if (historicalMatch) {
            throw new AppException(
              409,
              ERROR_CODES.LIKE_TARGET_NOT_ELIGIBLE,
              "Target cannot currently be interacted with",
            );
          }

          const currentLike = await this.likeRepository.findByActorAndTarget(
            input.userId,
            input.payload.targetUserId,
            tx,
          );

          let actorLike = currentLike;
          if (!currentLike) {
            actorLike = await this.likeRepository.create(tx, {
              actorId: input.userId,
              targetId: input.payload.targetUserId,
              introNote,
            });
          } else if (currentLike.status === "RETRACTED") {
            actorLike = await this.likeRepository.reactivate(
              tx,
              currentLike.id,
              introNote,
            );
          } else if (currentLike.status === "MATCHED") {
            return {
              kind: "existing-match" as const,
              like: currentLike,
            };
          }

          if (!actorLike) {
            throw new AppException(
              500,
              ERROR_CODES.INTERNAL_ERROR,
              "Like transaction failed to materialize actor like",
            );
          }

          const reciprocalLike = await this.likeRepository.findByActorAndTarget(
            input.payload.targetUserId,
            input.userId,
            tx,
          );

          if (
            reciprocalLike &&
            (reciprocalLike.status === "ACTIVE" ||
              reciprocalLike.status === "MATCHED")
          ) {
            const artifacts = await this.createMatchArtifactsService.execute(
              tx,
              {
                actorId: input.userId,
                targetId: input.payload.targetUserId,
                matchedAt: now,
              },
            );

            const matchedActorLike =
              actorLike.status === "MATCHED"
                ? actorLike
                : await this.likeRepository.markMatched(tx, actorLike.id, now);

            if (reciprocalLike.status === "ACTIVE") {
              await this.likeRepository.markMatched(tx, reciprocalLike.id, now);
            }

            await this.auditLogService.write(
              {
                actorUserId: input.userId,
                action: "like.match-created",
                entityType: "Match",
                entityId: artifacts.match.id,
                targetUserId: input.payload.targetUserId,
                ipAddress: input.metadata.ipAddress,
                userAgent: input.metadata.userAgent,
                metadata: {
                  likeId: matchedActorLike.id,
                  conversationId: artifacts.conversationId,
                },
              },
              tx,
            );

            await this.userRepository.touchLastActiveAt(input.userId, now, tx);

            return {
              kind: "match-created" as const,
              like: matchedActorLike,
              matchId: artifacts.match.id,
              conversationId: artifacts.conversationId,
            };
          }

          await this.auditLogService.write(
            {
              actorUserId: input.userId,
              action: "like.create",
              entityType: "Like",
              entityId: actorLike.id,
              targetUserId: input.payload.targetUserId,
              ipAddress: input.metadata.ipAddress,
              userAgent: input.metadata.userAgent,
            },
            tx,
          );

          await this.userRepository.touchLastActiveAt(input.userId, now, tx);

          return {
            kind: "like-recorded" as const,
            like: actorLike,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );

    await this.invalidateDiscoverySafely(input.userId);

    let response: CreateLikeResponseDto;
    if (transactionResult.kind === "match-created") {
      const like = this.likeReaderService.mapLike(transactionResult.like);
      response = await this.buildMatchedResponse(
        like,
        input.userId,
        input.payload.targetUserId,
        transactionResult.matchId,
        transactionResult.conversationId,
      );
      const targetResponse = await this.buildMatchedResponse(
        like,
        input.payload.targetUserId,
        input.userId,
        transactionResult.matchId,
        transactionResult.conversationId,
      );

      await this.invalidateDiscoverySafely(input.payload.targetUserId);
      await this.domainEventPublisher.publishSafely(MATCH_EVENTS.CREATED, {
        matchId: transactionResult.matchId,
        conversationId: transactionResult.conversationId,
        userIds: [input.userId, input.payload.targetUserId],
        matchByUserId: {
          [input.userId]: response.match,
          [input.payload.targetUserId]: targetResponse.match,
        },
      });
      await this.enqueueMatchNotificationSafely(
        transactionResult.matchId,
        transactionResult.conversationId,
        input.userId,
        input.payload.targetUserId,
      );
    } else if (transactionResult.kind === "existing-match") {
      response = await this.buildMatchedResponse(
        this.likeReaderService.mapLike(transactionResult.like),
        input.userId,
        input.payload.targetUserId,
      );
    } else {
      response = {
        outcome: "LIKE_RECORDED",
        like: this.likeReaderService.mapLike(transactionResult.like),
        match: null,
        conversation: null,
      };
      await this.domainEventPublisher.publishSafely(LIKE_EVENTS.CREATED, {
        likeId: transactionResult.like.id,
        actorId: transactionResult.like.actorId,
        targetId: transactionResult.like.targetId,
      });
    }

    await this.persistIdempotentResponse(
      input.userId,
      idempotencyKey,
      response,
    );

    return response;
  }

  private async buildMatchedResponse(
    like: LikeDto,
    viewerUserId: string,
    targetUserId: string,
    providedMatchId?: string,
    providedConversationId?: string,
  ): Promise<CreateLikeResponseDto> {
    const match =
      providedMatchId ??
      (await this.resolveMatchId(viewerUserId, targetUserId));
    if (!match) {
      return {
        outcome: "LIKE_RECORDED",
        like,
        match: null,
        conversation: null,
      };
    }

    const matchProjection = await this.matchReaderService.getRequiredMatch(
      match,
      viewerUserId,
    );
    if (matchProjection.status !== "ACTIVE") {
      throw new AppException(409, ERROR_CODES.MATCH_NOT_ACTIVE, "Match is no longer active");
    }
    const conversationId =
      providedConversationId ?? matchProjection.conversation?.id ?? null;
    const conversation =
      conversationId !== null
        ? await this.conversationReaderService.getRequiredConversation(
            conversationId,
            viewerUserId,
          )
        : null;

    return {
      outcome: "MATCH_CREATED",
      like,
      match: await this.matchReaderService.mapSummary(
        matchProjection,
        viewerUserId,
      ),
      conversation:
        conversation && conversationId
          ? await this.conversationReaderService.mapConversationSummary(
              conversation,
              viewerUserId,
            )
          : null,
    };
  }

  private async resolveMatchId(
    actorId: string,
    targetId: string,
  ): Promise<string | null> {
    const [userLowId, userHighId] =
      actorId < targetId ? [actorId, targetId] : [targetId, actorId];
    const match = await this.prisma.match.findUnique({
      where: {
        userLowId_userHighId: {
          userLowId,
          userHighId,
        },
      },
      select: {
        id: true,
      },
    });

    return match?.id ?? null;
  }

  private async persistIdempotentResponse(
    userId: string,
    idempotencyKey: string | undefined,
    response: CreateLikeResponseDto,
  ): Promise<void> {
    if (!idempotencyKey) {
      return;
    }

    await this.likeIdempotencyRepository.set<CachedLikeReceipt>(userId, idempotencyKey, {
      like: response.like,
      match: response.match ? { id: response.match.id } : null,
    });
  }

  private async invalidateDiscoverySafely(userId: string): Promise<void> {
    try {
      await this.discoveryInvalidationService.execute(userId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate discovery snapshot for user ${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async enqueueMatchNotificationSafely(
    matchId: string,
    conversationId: string,
    actorUserId: string,
    recipientUserId: string,
  ): Promise<void> {
    try {
      await this.bullmqProducer.enqueue(
        "notification.dispatch",
        {
          type: "NEW_MATCH",
          recipientUserId,
          actorUserId,
          matchId,
          conversationId,
        },
        {
          jobId: `notification:new-match:${matchId}:${recipientUserId}`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue new match notification for match ${matchId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function normalizeIntroNote(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class RetractLikeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly likePolicyService: LikePolicyService,
    private readonly likeRepository: LikeRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
  ) {}

  async execute(input: {
    userId: string;
    targetUserId: string;
    metadata: LikeActionMetadata;
  }): Promise<void> {
    await this.userReaderService.getRequiredById(input.userId);
    this.likePolicyService.assertCanLike(input.userId, input.targetUserId);

    const like = await this.likeRepository.findByActorAndTarget(
      input.userId,
      input.targetUserId,
    );

    if (!like || like.status === "MATCHED") {
      return;
    }

    this.likePolicyService.assertCanRetract(like);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.likeRepository.retract(tx, like.id, now);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "like.retract",
          entityType: "Like",
          entityId: like.id,
          targetUserId: input.targetUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });

    try {
      await this.discoveryInvalidationService.execute(input.userId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate discovery snapshot for user ${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

@Injectable()
export class CreatePassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly userRepository: UserRepository,
    private readonly passPolicyService: PassPolicyService,
    private readonly likeInteractionRepository: LikeInteractionRepository,
    private readonly passRepository: PassRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
  ) {}

  async execute(input: {
    userId: string;
    targetUserId: string;
    metadata: LikeActionMetadata;
  }): Promise<PassDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.passPolicyService.assertCanPass(input.userId, input.targetUserId);

    const target = await this.likeInteractionRepository.findLikeTarget(
      input.targetUserId,
    );
    if (!target || target.deletedAt !== null) {
      throw new AppException(
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "Target user not found",
      );
    }

    const expiresAt = addDays(new Date(), PASS_TTL_DAYS);
    const pass = await this.prisma.$transaction(async (tx) => {
      const row = await this.passRepository.upsertActive(tx, {
        actorId: input.userId,
        targetId: input.targetUserId,
        expiresAt,
      });

      await this.userRepository.touchLastActiveAt(input.userId, new Date(), tx);

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "pass.create",
          entityType: "Pass",
          entityId: row.id,
          targetUserId: input.targetUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return row;
    });

    try {
      await this.discoveryInvalidationService.execute(input.userId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate discovery snapshot for user ${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return mapPassDto(pass);
  }
}

@Injectable()
export class RetractPassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly passPolicyService: PassPolicyService,
    private readonly passRepository: PassRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
  ) {}

  async execute(input: {
    userId: string;
    targetUserId: string;
    metadata: LikeActionMetadata;
  }): Promise<void> {
    await this.userReaderService.getRequiredById(input.userId);
    this.passPolicyService.assertCanPass(input.userId, input.targetUserId);

    const pass = await this.passRepository.findByActorAndTarget(
      input.userId,
      input.targetUserId,
    );
    if (!pass || pass.deletedAt) {
      return;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.passRepository.softDelete(tx, pass.id, now);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "pass.retract",
          entityType: "Pass",
          entityId: pass.id,
          targetUserId: input.targetUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });

    try {
      await this.discoveryInvalidationService.execute(input.userId);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate discovery snapshot for user ${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

async function withSerializableRetry<TValue>(
  callback: () => Promise<TValue>,
): Promise<TValue> {
  let attempt = 0;

  while (attempt < SERIALIZABLE_RETRY_ATTEMPTS) {
    try {
      return await callback();
    } catch (error) {
      attempt += 1;
      if (
        !isSerializableConflict(error) ||
        attempt >= SERIALIZABLE_RETRY_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new AppException(
    500,
    ERROR_CODES.INTERNAL_ERROR,
    "Unexpected retry failure",
  );
}

function isSerializableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function mapPassDto(pass: {
  id: string;
  actorId: string;
  targetId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): PassDto {
  return {
    id: pass.id,
    actorId: pass.actorId,
    targetId: pass.targetId,
    expiresAt: pass.expiresAt.toISOString(),
    createdAt: pass.createdAt.toISOString(),
    updatedAt: pass.updatedAt.toISOString(),
  };
}
