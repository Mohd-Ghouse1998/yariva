import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import {
  haversineDistanceKm,
  resolveDistanceBand,
} from "../../../common/utils/distance.util";
import { canonicalUserPair } from "../../../common/utils/pair.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import type {
  Match,
  MatchCommunicationSetting,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";
import { InvalidateDiscoverySnapshotService } from "../../discovery/application/discovery.services";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import { mapDatingProfileFields, mapProfileLocality } from "../../discovery/application/public-profile-fields";
import { canViewProfileField } from "../../profiles/domain/profile-field-audience";
import {
  ConversationArtifactService,
  ConversationCloserService,
} from "../../conversations/application/conversations.services";
import {
  CONVERSATION_EVENTS,
} from "../../conversations/events/conversations.events";
import type {
  EndMatchResponseDto,
  MatchCommunicationSettingDto,
  MatchDetailDto,
  MatchDetailResponseDto,
  MatchPageDto,
  MatchSummaryDto,
  UpdateMyMatchCommunicationSettingDto,
  UpdateMyMatchCommunicationSettingResponseDto,
} from "../dto/matches.dto";
import {
  MatchCommunicationPolicyService,
  MatchParticipantPolicy,
  MatchPolicyService,
} from "../domain/matches.domain";
import { MATCH_EVENTS } from "../events/matches.events";
import {
  MatchCommunicationSettingRepository,
  MatchRepository,
  type MatchProjection,
} from "../infrastructure/matches.infrastructure";

type MatchUserProjection = User & {
  profile: UserProfile | null;
  photos: Pick<
    ProfilePhoto,
    "id" | "objectKey" | "bucket" | "width" | "height" | "isPrimary" | "position"
  >[];
  lifestyle: UserLifestyle | null;
  interests: (Pick<UserInterest, "interestTagId"> & {
    interestTag: {
      id: string;
      slug: string;
      displayName: string;
      category: string | null;
    };
  })[];
  intents: Pick<UserIntent, "intent">[];
};

export interface MatchActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface MatchArtifactsResult {
  match: Match;
  conversationId: string;
  created: boolean;
}

@Injectable()
export class MatchReaderService {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly matchPolicyService: MatchPolicyService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async getRequiredMatch(
    matchId: string,
    userId: string,
  ): Promise<MatchProjection> {
    const match = await this.matchRepository.findByIdForUser(matchId, userId);
    this.matchPolicyService.assertReadable(match, userId);
    return match;
  }

  async mapSummary(
    match: MatchProjection,
    viewerUserId: string,
  ): Promise<MatchSummaryDto> {
    const otherUser = resolveOtherUser(match, viewerUserId);
    const viewer = resolveViewerUser(match, viewerUserId);
    const mySetting = resolveCommunicationSetting(
      match,
      viewerUserId,
      match.updatedAt,
    );

    return {
      id: match.id,
      status: match.status,
      matchedAt: match.matchedAt.toISOString(),
      endedAt: match.endedAt?.toISOString() ?? null,
      endedReason: match.endedReason ?? null,
      otherUser: await mapPublicProfile(
        viewer.profile,
        otherUser,
        this.objectStorageService,
        viewerUserId,
        match.status === "ACTIVE",
      ),
      conversationId: match.conversation?.id ?? null,
      myCommunicationSetting: mapMatchCommunicationSettingDto(mySetting),
      lastMessagePreview: match.conversation?.lastMessagePreview ?? null,
      lastMessageSentAt: match.conversation?.lastMessageSentAt?.toISOString() ?? null,
    };
  }

  async mapDetail(
    match: MatchProjection,
    viewerUserId: string,
  ): Promise<MatchDetailDto> {
    const summary = await this.mapSummary(match, viewerUserId);
    const otherUser = resolveOtherUser(match, viewerUserId);
    const otherSetting = resolveCommunicationSetting(
      match,
      otherUser.id,
      match.updatedAt,
    );

    return {
      ...summary,
      otherUserCommunicationAllowed: {
        allowVoiceCalls: otherSetting.allowVoiceCalls,
        allowVideoCalls: otherSetting.allowVideoCalls,
      },
    };
  }
}

@Injectable()
export class CreateMatchArtifactsService {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly matchCommunicationSettingRepository: MatchCommunicationSettingRepository,
    private readonly conversationArtifactService: ConversationArtifactService,
  ) {}

  async execute(
    executor: PrismaTransactionalClient,
    input: {
      actorId: string;
      targetId: string;
      matchedAt: Date;
    },
  ): Promise<MatchArtifactsResult> {
    const pair = canonicalUserPair(input.actorId, input.targetId);
    let match = await this.matchRepository.findByPair(
      pair.userLowId,
      pair.userHighId,
      executor,
    );
    let created = false;

    if (!match) {
      match = await this.matchRepository.create(executor, {
        userLowId: pair.userLowId,
        userHighId: pair.userHighId,
        matchedAt: input.matchedAt,
      });
      created = true;
    }

    const conversation = await this.conversationArtifactService.ensureForMatch(
      executor,
      {
        matchId: match.id,
        userLowId: pair.userLowId,
        userHighId: pair.userHighId,
      },
    );

    await this.matchCommunicationSettingRepository.upsertDefaults(executor, {
      matchId: match.id,
      userIds: [pair.userLowId, pair.userHighId],
    });

    return {
      match,
      conversationId: conversation.id,
      created,
    };
  }
}

@Injectable()
export class ListMatchesService {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly matchReaderService: MatchReaderService,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<MatchPageDto> {
    const page = await this.matchRepository.listByUser(input.userId, {
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: await Promise.all(
        page.items.map((match) =>
          this.matchReaderService.mapSummary(match, input.userId),
        ),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class GetMatchService {
  constructor(private readonly matchReaderService: MatchReaderService) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<MatchDetailResponseDto> {
    const match = await this.matchReaderService.getRequiredMatch(
      input.matchId,
      input.userId,
    );

    return {
      match: await this.matchReaderService.mapDetail(match, input.userId),
    };
  }
}

@Injectable()
export class EndMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchRepository: MatchRepository,
    private readonly matchReaderService: MatchReaderService,
    private readonly matchPolicyService: MatchPolicyService,
    private readonly matchParticipantPolicy: MatchParticipantPolicy,
    private readonly conversationCloserService: ConversationCloserService,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    metadata: MatchActionMetadata;
  }): Promise<EndMatchResponseDto> {
    const current = await this.matchRepository.findByIdForUser(
      input.matchId,
      input.userId,
    );
    this.matchPolicyService.assertReadable(current, input.userId);
    this.matchParticipantPolicy.assertParticipant(input.userId, current);

    if (current.status === "ACTIVE") {
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await this.matchRepository.end(tx, {
          matchId: current.id,
          endedAt: now,
          endedByUserId: input.userId,
          endedReason: "UNMATCHED",
        });

        const closedConversation = await this.conversationCloserService.closeForMatch(
          tx,
          {
            matchId: current.id,
            status: "CLOSED_UNMATCHED",
            closedReason: "UNMATCHED",
            closedAt: now,
          },
        );

        const cancelledDatePlans = await tx.datePlan.updateMany({
          where: {
            matchId: current.id,
            status: { in: ["DRAFT", "PROPOSED", "COUNTERED", "ACCEPTED"] },
          },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        await tx.callSession.updateMany({
          where: { matchId: current.id, status: { in: ["RINGING", "ACCEPTED", "CONNECTING", "CONNECTED"] } },
          data: { status: "ENDED", endedAt: now, endedByUserId: input.userId, endReason: "UNMATCHED" },
        });

        await this.auditLogService.write(
          {
            actorUserId: input.userId,
            action: "match.end",
            entityType: "Match",
            entityId: current.id,
            targetUserId:
              current.userLowId === input.userId ? current.userHighId : current.userLowId,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
            metadata: {
              conversationId: closedConversation?.id ?? null,
              cancelledDatePlans: cancelledDatePlans.count,
            },
          },
          tx,
        );
      });

      await this.discoveryInvalidationService.execute(current.userLowId);
      await this.discoveryInvalidationService.execute(current.userHighId);
      await this.domainEventPublisher.publishSafely(MATCH_EVENTS.ENDED, {
        matchId: current.id,
        endedByUserId: input.userId,
        userLowId: current.userLowId,
        userHighId: current.userHighId,
        endedReason: "UNMATCHED",
      });
      if (current.conversation?.id) {
        await this.domainEventPublisher.publishSafely(CONVERSATION_EVENTS.CLOSED, {
          conversationId: current.conversation.id,
          matchId: current.id,
          status: "CLOSED_UNMATCHED",
          closedReason: "UNMATCHED",
          recipientUserIds: [current.userLowId, current.userHighId],
        });
      }
    }

    const updated = await this.matchReaderService.getRequiredMatch(
      input.matchId,
      input.userId,
    );

    return {
      match: await this.matchReaderService.mapSummary(updated, input.userId),
    };
  }
}

@Injectable()
export class UpdateMatchCommunicationSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchRepository: MatchRepository,
    private readonly matchPolicyService: MatchPolicyService,
    private readonly matchCommunicationPolicyService: MatchCommunicationPolicyService,
    private readonly matchCommunicationSettingRepository: MatchCommunicationSettingRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    matchId: string;
    payload: UpdateMyMatchCommunicationSettingDto;
    metadata: MatchActionMetadata;
  }): Promise<UpdateMyMatchCommunicationSettingResponseDto> {
    const match = await this.matchRepository.findByIdForUser(
      input.matchId,
      input.userId,
    );
    this.matchPolicyService.assertReadable(match, input.userId);
    this.matchCommunicationPolicyService.assertManageable(match);

    const setting = await this.prisma.$transaction(async (tx) => {
      const updatedSetting =
        await this.matchCommunicationSettingRepository.updateForUser(tx, {
          matchId: input.matchId,
          userId: input.userId,
          allowVoiceCalls: input.payload.allowVoiceCalls,
          allowVideoCalls: input.payload.allowVideoCalls,
          muted: input.payload.muted,
        });

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "match.communication-setting.update",
          entityType: "MatchCommunicationSetting",
          entityId: updatedSetting.id,
          targetUserId:
            match.userLowId === input.userId ? match.userHighId : match.userLowId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return updatedSetting;
    });

    const dto = mapMatchCommunicationSettingDto(setting);
    await this.domainEventPublisher.publishSafely(
      MATCH_EVENTS.COMMUNICATION_SETTING_UPDATED,
      {
        matchId: input.matchId,
        userId: input.userId,
        setting: dto,
      },
    );

    return {
      setting: dto,
    };
  }
}

function resolveOtherUser(
  match: MatchProjection,
  viewerUserId: string,
): MatchUserProjection {
  return match.userLowId === viewerUserId ? match.userHigh : match.userLow;
}

function resolveViewerUser(
  match: MatchProjection,
  viewerUserId: string,
): MatchUserProjection {
  return match.userLowId === viewerUserId ? match.userLow : match.userHigh;
}

function resolveCommunicationSetting(
  match: Pick<
    MatchProjection,
    "id" | "communicationSettings"
  >,
  userId: string,
  fallbackUpdatedAt: Date,
): MatchCommunicationSetting {
  const existing = match.communicationSettings.find(
    (setting) => setting.userId === userId,
  );

  if (existing) {
    return existing;
  }

  return {
    id: `synthetic-${match.id}-${userId}`,
    matchId: match.id,
    userId,
    allowVoiceCalls: true,
    allowVideoCalls: true,
    muted: false,
    createdAt: fallbackUpdatedAt,
    updatedAt: fallbackUpdatedAt,
  };
}

function mapMatchCommunicationSettingDto(
  setting: Pick<
    MatchCommunicationSetting,
    "matchId" | "userId" | "allowVoiceCalls" | "allowVideoCalls" | "muted" | "updatedAt"
  >,
): MatchCommunicationSettingDto {
  return {
    matchId: setting.matchId,
    userId: setting.userId,
    allowVoiceCalls: setting.allowVoiceCalls,
    allowVideoCalls: setting.allowVideoCalls,
    muted: setting.muted,
    updatedAt: setting.updatedAt.toISOString(),
  };
}

async function mapPublicProfile(
  viewerProfile: UserProfile | null,
  otherUser: MatchUserProjection,
  objectStorageService: ObjectStorageService,
  viewerId: string,
  activeMatch: boolean,
): Promise<PublicProfileDto> {
  const otherProfile = otherUser.profile;
  const distance = resolveLocationSummary(viewerProfile, otherProfile, activeMatch);
  const photos = await Promise.all(
    otherUser.photos.map(async (photo) => ({
      id: photo.id,
      url: await objectStorageService.createPresignedGetObject({
        disclosure: { viewerId, ownerId: otherUser.id },
        bucket: photo.bucket,
        objectKey: photo.objectKey,
      }),
      width: photo.width ?? null,
      height: photo.height ?? null,
      isPrimary: photo.isPrimary,
      position: photo.position,
    })),
  );

  return {
    userId: otherUser.id,
    displayName: otherProfile?.displayName ?? "Unknown",
    ...mapDatingProfileFields(otherUser.profile, {
      activeMatch,
      lifestyle: otherUser.lifestyle,
      interests: otherUser.interests.map(({ interestTag }) => ({
        id: interestTag.id, slug: interestTag.slug, displayName: interestTag.displayName, category: interestTag.category,
      })),
    }),
    location: distance,
    intents: otherUser.intents.map((intent) => intent.intent),
    photos,
  };
}

function resolveLocationSummary(
  viewerProfile: UserProfile | null,
  otherProfile: UserProfile | null,
  activeMatch: boolean,
): PublicProfileDto["location"] {
  if (
    !otherProfile ||
    !canViewProfileField(otherProfile, "distance", activeMatch) ||
    !viewerProfile?.locationLat ||
    !viewerProfile.locationLng ||
    otherProfile.locationLat === null ||
    otherProfile.locationLng === null
  ) {
    return {
      ...mapProfileLocality(otherProfile, activeMatch),
      distanceKmRounded: 0,
      distanceBand: null,
    };
  }

  const distanceKm = Math.round(
    haversineDistanceKm(
      Number(viewerProfile.locationLat.toString()),
      Number(viewerProfile.locationLng.toString()),
      Number(otherProfile.locationLat.toString()),
      Number(otherProfile.locationLng.toString()),
    ),
  );

  return {
    ...mapProfileLocality(otherProfile, activeMatch),
    distanceKmRounded: distanceKm,
    distanceBand: resolveDistanceBand(distanceKm),
  };
}
