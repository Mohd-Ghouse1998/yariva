import { conversationParticipantIds, relationshipIsActive } from "../domain/conversation-context";
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import {
  haversineDistanceKm,
  resolveDistanceBand,
} from "../../../common/utils/distance.util";
import {
  resolveVisibleAttachment,
  resolveVisibleTextBody,
} from "../../../common/utils/message-visibility.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { UserProfile } from "../../../generated/prisma/client";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
import { mapDatingProfileFields } from "../../discovery/application/public-profile-fields";
import type {
  ConnectionIntentValue,
  DietPreferenceValue,
  DrinkingHabitValue,
  ExerciseHabitValue,
  PetPreferenceValue,
  SleepPatternValue,
  SmokingHabitValue,
  SocialEnergyValue,
} from "../../profiles/dto/profiles.dto";
import type {
  ConversationDetailResponseDto,
  ConversationPageDto,
  ConversationReadDto,
  ConversationReadResponseDto,
  ConversationSummaryDto,
  MessageDto,
  MessagePageDto,
} from "../dto/conversations.dto";
import {
  ConversationAccessPolicyService,
  UnreadCounterService,
} from "../domain/conversations.domain";
import {
  CONVERSATION_EVENTS,
} from "../events/conversations.events";
import {
  ConversationReadRepository,
  ConversationRepository,
  MessageRepository,
  type ConversationProjection,
} from "../infrastructure/conversations.infrastructure";

@Injectable()
export class ConversationReaderService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly unreadCounterService: UnreadCounterService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async getRequiredConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationProjection> {
    const conversation = await this.conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new AppException(
        404,
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Conversation not found",
      );
    }

    return conversation;
  }

  async mapConversationSummary(
    conversation: ConversationProjection,
    viewerUserId: string,
  ): Promise<ConversationSummaryDto> {
    const users = conversation.match ? [conversation.match.userLow, conversation.match.userHigh] :
      conversation.members.map((member) => member.user);
    const otherUser = users.find((user) => user.id !== viewerUserId)!;
    const viewerProfile = users.find((user) => user.id === viewerUserId)?.profile ?? null;
    const readState = conversation.reads.find(read => read.userId === viewerUserId);

    return {
      id: conversation.id,
      matchId: conversation.matchId,
      kind: conversation.duoMatchId ? "DUO" : "SOLO",
      duoMatchId: conversation.duoMatchId,
      participants: await Promise.all(users.map((user) => mapPublicProfile(viewerProfile, user, this.objectStorageService, viewerUserId))),
      readStates: conversation.reads.map(read => ({ userId: read.userId, lastReadSequence: read.lastReadSequence })),
      status: conversation.status,
      otherUser: await mapPublicProfile(
        viewerProfile,
        otherUser,
        this.objectStorageService,
        viewerUserId,
      ),
      lastMessageSequence: conversation.lastMessageSequence,
      lastMessagePreview: conversation.lastMessagePreview ?? null,
      lastMessageType: conversation.lastMessageType ?? null,
      lastMessageSentAt: conversation.lastMessageSentAt?.toISOString() ?? null,
      lastSenderId: conversation.lastSenderId ?? null,
      lastReadSequence: readState?.lastReadSequence ?? 0,
      unreadCount: this.unreadCounterService.derive(
        conversation.lastMessageSequence,
        readState?.lastReadSequence ?? 0,
      ),
      closedAt: conversation.closedAt?.toISOString() ?? null,
      closedReason: conversation.closedReason ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class ConversationArtifactService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
  ) {}

  async ensureForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      userLowId: string;
      userHighId: string;
    },
  ) {
    const conversation = await this.conversationRepository.upsertForMatch(
      executor,
      {
        matchId: input.matchId,
      },
    );

    await this.conversationReadRepository.upsertParticipantReadState(executor, {
      conversationId: conversation.id,
      userId: input.userLowId,
    });
    await this.conversationReadRepository.upsertParticipantReadState(executor, {
      conversationId: conversation.id,
      userId: input.userHighId,
    });

    return conversation;
  }
}

@Injectable()
export class ConversationCloserService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async closeForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      status: "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
      closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED";
      closedAt: Date;
    },
  ) {
    return this.conversationRepository.closeForMatch(executor, input);
  }
}

@Injectable()
export class ListConversationsService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReaderService: ConversationReaderService,
  ) {}

  async execute(input: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<ConversationPageDto> {
    const page = await this.conversationRepository.listByUser(input.userId, {
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: await Promise.all(
        page.items.map((conversation) =>
          this.conversationReaderService.mapConversationSummary(
            conversation,
            input.userId,
          ),
        ),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class GetConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationAccessPolicyService: ConversationAccessPolicyService,
    private readonly conversationReaderService: ConversationReaderService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
  }): Promise<ConversationDetailResponseDto> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );

    this.conversationAccessPolicyService.assertReadable(conversation);
    this.conversationAccessPolicyService.assertParticipant(
      input.userId,
      conversation,
    );

    return {
      conversation: await this.conversationReaderService.mapConversationSummary(
        conversation,
        input.userId,
      ),
    };
  }
}

@Injectable()
export class ListConversationMessagesService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationAccessPolicyService: ConversationAccessPolicyService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
    cursor?: string;
    limit?: number;
  }): Promise<MessagePageDto> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );
    this.conversationAccessPolicyService.assertReadable(conversation);
    this.conversationAccessPolicyService.assertParticipant(
      input.userId,
      conversation,
    );

    const page = await this.messageRepository.listByConversation(
      input.conversationId,
      {
        cursor: input.cursor,
        limit: input.limit ?? 50,
      },
    );

    return {
      items: await Promise.all(
        page.items.map((message) =>
          mapMessageDto(message, input.userId, this.objectStorageService),
        ),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class MarkConversationReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationAccessPolicyService: ConversationAccessPolicyService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
    lastReadSequence: number;
  }): Promise<ConversationReadResponseDto> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const conversation = await this.conversationRepository.findByIdForUser(
        input.conversationId,
        input.userId,
        tx,
      );
      this.conversationAccessPolicyService.assertReadable(conversation);
      this.conversationAccessPolicyService.assertParticipant(input.userId, conversation);
      this.conversationAccessPolicyService.assertCanUpdateReadState(
        conversation,
        { status: relationshipIsActive(conversation) ? "ACTIVE" : "ENDED" },
        {
          currentLastReadSequence: conversation.reads.find(read => read.userId === input.userId)?.lastReadSequence ?? 0,
          requestedLastReadSequence: input.lastReadSequence,
        },
      );
      const lastReadMessage =
        input.lastReadSequence > 0
          ? await this.messageRepository.findByConversationAndSequence(
              input.conversationId,
              input.lastReadSequence,
              tx,
            )
          : null;

      const readState = await this.conversationReadRepository.updateReadState(tx, {
        conversationId: input.conversationId,
        userId: input.userId,
        lastReadMessageId: lastReadMessage?.id ?? null,
        lastReadSequence: input.lastReadSequence,
        lastReadAt: now,
      });

      return { readState, participantIds: conversationParticipantIds(conversation) };
    });

    await this.domainEventPublisher.publishSafely(CONVERSATION_EVENTS.READ_UPDATED, {
      // Fan out to the peer and the actor's own active devices.
      conversationId: input.conversationId,
      readState: mapConversationReadDto(result.readState),
      recipientUserIds: result.participantIds,
    });

    return {
      readState: mapConversationReadDto(result.readState),
    };
  }
}

async function mapMessageDto(message: {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  clientMessageId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
  textBody: string | null;
  attachmentObjectKey: string | null;
  attachmentBucket: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
  attachmentWidth: number | null;
  attachmentHeight: number | null;
  attachmentDurationSeconds: number | null;
  attachmentModerationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  status:
    | "ACTIVE"
    | "PENDING_MODERATION"
    | "REMOVED_BY_MODERATION"
    | "DELETED_BY_SENDER";
  replyToMessageId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, viewerUserId: string, objectStorageService: ObjectStorageService): Promise<MessageDto> {
  const attachment = resolveVisibleAttachment(message, viewerUserId, () => "");
  if (attachment.objectKey && message.attachmentBucket) {
    attachment.url = `messages/${message.id}/attachment`;
    attachment.objectKey = null;
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sequence: message.sequence,
    clientMessageId: message.clientMessageId ?? null,
    type: message.type,
    textBody: resolveVisibleTextBody(message),
    attachment,
    status: message.status,
    replyToMessageId: message.replyToMessageId ?? null,
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function mapConversationReadDto(readState: {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadSequence: number;
  lastReadAt: Date | null;
}): ConversationReadDto {
  return {
    conversationId: readState.conversationId,
    userId: readState.userId,
    lastReadMessageId: readState.lastReadMessageId ?? null,
    lastReadSequence: readState.lastReadSequence,
    lastReadAt: (readState.lastReadAt ?? new Date()).toISOString(),
  };
}

async function mapPublicProfile(
  viewerProfile: {
    locationLat: { toString(): string } | null;
    locationLng: { toString(): string } | null;
  } | null,
  user: {
    id: string;
    profile: UserProfile | null;
    interests: Array<{
      interestTag: {
        id: string;
        slug: string;
        displayName: string;
        category: string | null;
      };
    }>;
    intents: Array<{
      intent: ConnectionIntentValue;
    }>;
    lifestyle: {
      smoking: SmokingHabitValue | null;
      drinking: DrinkingHabitValue | null;
      exercise: ExerciseHabitValue | null;
      diet: DietPreferenceValue | null;
      petPreference: PetPreferenceValue | null;
      sleepPattern: SleepPatternValue | null;
      socialEnergy: SocialEnergyValue | null;
    } | null;
    photos: Array<{
      id: string;
      objectKey: string;
      bucket: string;
      width: number | null;
      height: number | null;
      isPrimary: boolean;
      position: number;
    }>;
  },
  objectStorageService: ObjectStorageService,
  viewerId: string,
): Promise<PublicProfileDto> {
  const profile = user.profile;
  const distanceKm =
    !profile?.hideDistance &&
    viewerProfile?.locationLat &&
    viewerProfile.locationLng &&
    profile?.locationLat &&
    profile.locationLng
      ? haversineDistanceKm(
          Number(viewerProfile.locationLat.toString()),
          Number(viewerProfile.locationLng.toString()),
          Number(profile.locationLat.toString()),
          Number(profile.locationLng.toString()),
        )
      : null;

  const photos = await Promise.all(
    user.photos.map(async (photo) => ({
      id: photo.id,
      url: await objectStorageService.createPresignedGetObject({
        disclosure: { viewerId, ownerId: user.id },
        bucket: photo.bucket,
        objectKey: photo.objectKey,
      }),
      width: photo.width,
      height: photo.height,
      isPrimary: photo.isPrimary,
      position: photo.position,
    })),
  );

  return {
    userId: user.id,
    displayName: profile?.displayName ?? "Unknown",
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    age:
      profile?.hideAge === true
        ? null
        : profile?.dateOfBirth
          ? calculateAge(profile.dateOfBirth)
          : null,
    gender: profile?.gender ?? null,
    pronouns: profile?.pronouns ?? null,
    ...mapDatingProfileFields(profile),
    location: {
      city: profile?.city ?? null,
      region: profile?.region ?? null,
      countryCode: profile?.countryCode ?? null,
      distanceKmRounded: distanceKm === null ? 0 : Math.round(distanceKm),
      distanceBand: distanceKm === null ? null : resolveDistanceBand(distanceKm),
    },
    intents: user.intents.map((intent) => intent.intent),
    interests: user.interests.map((interest) => ({
      id: interest.interestTag.id,
      slug: interest.interestTag.slug,
      displayName: interest.interestTag.displayName,
      category: interest.interestTag.category,
    })),
    lifestyle: {
      smoking: user.lifestyle?.smoking ?? null,
      drinking: user.lifestyle?.drinking ?? null,
      exercise: user.lifestyle?.exercise ?? null,
      diet: user.lifestyle?.diet ?? null,
      petPreference: user.lifestyle?.petPreference ?? null,
      sleepPattern: user.lifestyle?.sleepPattern ?? null,
      socialEnergy: user.lifestyle?.socialEnergy ?? null,
    },
    photos,
  };
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
