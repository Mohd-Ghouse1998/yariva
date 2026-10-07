FILE: package.json
```json
{
  "name": "aroha-backend",
  "version": "0.1.0",
  "private": true,
  "description": "Aroha backend modular monolith",
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./tests/jest-e2e.json",
    "prisma:generate": "prisma generate --config prisma.config.ts",
    "prisma:migrate:dev": "prisma migrate dev --config prisma.config.ts",
    "prisma:migrate:deploy": "prisma migrate deploy --config prisma.config.ts",
    "prisma:studio": "prisma studio --config prisma.config.ts"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.914.0",
    "@aws-sdk/s3-request-presigner": "^3.914.0",
    "@nestjs/bullmq": "^11.0.2",
    "@nestjs/common": "^11.0.6",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.6",
    "@nestjs/jwt": "^11.0.1",
    "@nestjs/platform-express": "^11.0.6",
    "@nestjs/platform-socket.io": "^11.1.19",
    "@nestjs/throttler": "^6.4.0",
    "@nestjs/websockets": "^11.1.19",
    "@prisma/adapter-pg": "^7.7.0",
    "@prisma/client": "^7.7.0",
    "bcryptjs": "^2.4.3",
    "bullmq": "^5.56.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "dotenv": "^16.5.0",
    "helmet": "^8.1.0",
    "ioredis": "^5.5.0",
    "joi": "^17.13.3",
    "libphonenumber-js": "^1.12.8",
    "pg": "^8.13.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.8.3"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.5",
    "@nestjs/schematics": "^11.0.4",
    "@nestjs/testing": "^11.0.6",
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.15.3",
    "@types/supertest": "^6.0.3",
    "jest": "^29.7.0",
    "prisma": "^7.7.0",
    "supertest": "^7.1.1",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  }
}

```

FILE: src/app.module.ts
```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigType } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import appConfig from "./config/app.config";
import authConfig from "./config/auth.config";
import bullmqConfig from "./config/bullmq.config";
import databaseConfig from "./config/database.config";
import objectStorageConfig from "./config/object-storage.config";
import redisConfig from "./config/redis.config";
import { validationSchema } from "./config/validation.schema";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AppLogger } from "./common/logger/app-logger.service";
import { PrismaModule } from "./database/prisma/prisma.module";
import { BullmqModule } from "./integrations/bullmq/bullmq.module";
import { ObjectStorageModule } from "./integrations/object-storage/object-storage.module";
import { RedisModule } from "./integrations/redis/redis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { LikesModule } from "./modules/likes/likes.module";
import { MatchesModule } from "./modules/matches/matches.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { PresenceModule } from "./modules/presence/presence.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { InterestsModule } from "./modules/interests/interests.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        bullmqConfig,
        objectStorageConfig,
      ],
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => [
        {
          ttl: config.defaultThrottleTtlMs,
          limit: config.defaultThrottleLimit,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    BullmqModule,
    ObjectStorageModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    ProfilesModule,
    InterestsModule,
    DiscoveryModule,
    LikesModule,
    MatchesModule,
    ConversationsModule,
    MessagesModule,
    PresenceModule,
  ],
  providers: [
    AppLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

```

FILE: src/common/utils/message-visibility.util.ts
```ts
import type { ContentModerationStatus, MessageStatus, MessageType } from "../../generated/prisma/client";

export interface MessageVisibilityRecord {
  senderId: string;
  type: MessageType;
  textBody: string | null;
  attachmentObjectKey: string | null;
  attachmentBucket: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
  attachmentWidth: number | null;
  attachmentHeight: number | null;
  attachmentDurationSeconds: number | null;
  attachmentModerationStatus: ContentModerationStatus | null;
  status: MessageStatus;
  createdAt: Date;
}

export interface VisibleAttachmentView {
  objectKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  moderationStatus: ContentModerationStatus | null;
}

export interface ConversationPreviewView {
  preview: string | null;
  type: MessageType;
  sentAt: Date;
  senderId: string;
}

const REMOVED_MESSAGE_PREVIEW = "Message removed";
const PENDING_ATTACHMENT_PREVIEW = "Attachment pending review";

export function resolveVisibleTextBody(
  message: MessageVisibilityRecord,
): string | null {
  if (isTombstoned(message.status)) {
    return null;
  }

  return message.textBody ?? null;
}

export function resolveVisibleAttachment(
  message: MessageVisibilityRecord,
  viewerUserId: string,
): VisibleAttachmentView {
  const moderationStatus = message.attachmentModerationStatus ?? null;
  const isVisible =
    !isTombstoned(message.status) &&
    message.attachmentObjectKey !== null &&
    message.attachmentBucket !== null &&
    (moderationStatus === null ||
      moderationStatus === "APPROVED" ||
      (moderationStatus === "PENDING" && message.senderId === viewerUserId));

  if (!isVisible) {
    return {
      objectKey: null,
      url: null,
      mimeType: null,
      sizeBytes: null,
      width: null,
      height: null,
      durationSeconds: null,
      moderationStatus,
    };
  }

  return {
    objectKey: message.attachmentObjectKey,
    url: buildAttachmentUrl(message.attachmentBucket, message.attachmentObjectKey),
    mimeType: message.attachmentMimeType ?? null,
    sizeBytes: message.attachmentSizeBytes ?? null,
    width: message.attachmentWidth ?? null,
    height: message.attachmentHeight ?? null,
    durationSeconds: message.attachmentDurationSeconds ?? null,
    moderationStatus,
  };
}

export function resolveConversationPreview(
  message: MessageVisibilityRecord,
): ConversationPreviewView {
  if (isTombstoned(message.status)) {
    return {
      preview: REMOVED_MESSAGE_PREVIEW,
      type: message.type,
      sentAt: message.createdAt,
      senderId: message.senderId,
    };
  }

  switch (message.type) {
    case "TEXT":
      return {
        preview: truncatePreview(message.textBody),
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "IMAGE":
      return {
        preview:
          message.attachmentModerationStatus === "PENDING"
            ? PENDING_ATTACHMENT_PREVIEW
            : "Photo",
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "VIDEO":
      return {
        preview:
          message.attachmentModerationStatus === "PENDING"
            ? PENDING_ATTACHMENT_PREVIEW
            : "Video",
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "AUDIO":
      return {
        preview:
          message.attachmentModerationStatus === "PENDING"
            ? PENDING_ATTACHMENT_PREVIEW
            : "Audio",
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
    case "SYSTEM":
      return {
        preview: truncatePreview(message.textBody),
        type: message.type,
        sentAt: message.createdAt,
        senderId: message.senderId,
      };
  }
}

export function isTombstoned(status: MessageStatus): boolean {
  return status === "DELETED_BY_SENDER" || status === "REMOVED_BY_MODERATION";
}

function buildAttachmentUrl(bucket: string | null, objectKey: string | null): string | null {
  if (!bucket || !objectKey) {
    return null;
  }

  return `s3://${bucket}/${objectKey}`;
}

function truncatePreview(value: string | null, maxLength = 160): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

```

FILE: src/modules/conversations/application/conversations.services.ts
```ts
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
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";
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

  mapConversationSummary(
    conversation: ConversationProjection,
    viewerUserId: string,
  ): ConversationSummaryDto {
    const otherUser =
      conversation.match.userLowId === viewerUserId
        ? conversation.match.userHigh
        : conversation.match.userLow;
    const viewerProfile =
      conversation.match.userLowId === viewerUserId
        ? conversation.match.userLow.profile
        : conversation.match.userHigh.profile;
    const readState = conversation.reads[0];

    return {
      id: conversation.id,
      matchId: conversation.matchId,
      status: conversation.status,
      otherUser: mapPublicProfile(viewerProfile, otherUser),
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
      items: page.items.map((conversation) =>
        this.conversationReaderService.mapConversationSummary(
          conversation,
          input.userId,
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
      conversation.match,
    );

    return {
      conversation: this.conversationReaderService.mapConversationSummary(
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
      conversation.match,
    );

    const page = await this.messageRepository.listByConversation(
      input.conversationId,
      {
        cursor: input.cursor,
        limit: input.limit ?? 50,
      },
    );

    return {
      items: page.items.map((message) => mapMessageDto(message, input.userId)),
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
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );

    this.conversationAccessPolicyService.assertReadable(conversation);
    this.conversationAccessPolicyService.assertParticipant(
      input.userId,
      conversation.match,
    );

    const currentReadState = conversation.reads[0];
    this.conversationAccessPolicyService.assertCanUpdateReadState(
      conversation,
      conversation.match,
      {
        currentLastReadSequence: currentReadState?.lastReadSequence ?? 0,
        requestedLastReadSequence: input.lastReadSequence,
      },
    );

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
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

      return readState;
    });

    await this.domainEventPublisher.publish(CONVERSATION_EVENTS.READ_UPDATED, {
      conversationId: input.conversationId,
      readState: mapConversationReadDto(result),
      recipientUserIds: [
        conversation.match.userLowId === input.userId
          ? conversation.match.userHighId
          : conversation.match.userLowId,
      ],
    });

    return {
      readState: mapConversationReadDto(result),
    };
  }
}

function mapMessageDto(message: {
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
}, viewerUserId: string): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sequence: message.sequence,
    clientMessageId: message.clientMessageId ?? null,
    type: message.type,
    textBody: resolveVisibleTextBody(message),
    attachment: resolveVisibleAttachment(message, viewerUserId),
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

function mapPublicProfile(
  viewerProfile: {
    locationLat: { toString(): string } | null;
    locationLng: { toString(): string } | null;
  } | null,
  user: {
    id: string;
    profile: {
      displayName: string | null;
      headline: string | null;
      bio: string | null;
      dateOfBirth: Date | null;
      gender: PublicProfileDto["gender"];
      pronouns: string | null;
      city: string | null;
      region: string | null;
      countryCode: string | null;
      hideDistance: boolean;
      locationLat: { toString(): string } | null;
      locationLng: { toString(): string } | null;
    } | null;
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
): PublicProfileDto {
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

  return {
    userId: user.id,
    displayName: profile?.displayName ?? "Unknown",
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    age: profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : 0,
    gender: profile?.gender ?? null,
    pronouns: profile?.pronouns ?? null,
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
    photos: user.photos.map((photo) => ({
      id: photo.id,
      url: `s3://${photo.bucket}/${photo.objectKey}`,
      width: photo.width,
      height: photo.height,
      isPrimary: photo.isPrimary,
      position: photo.position,
    })),
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

```

FILE: src/modules/conversations/conversations.module.ts
```ts
import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { ConversationsController } from "./controllers/conversations.controller";
import {
  ConversationArtifactService,
  ConversationCloserService,
  ConversationReaderService,
  GetConversationService,
  ListConversationMessagesService,
  ListConversationsService,
  MarkConversationReadService,
} from "./application/conversations.services";
import {
  ConversationAccessPolicyService,
  ConversationParticipantPolicy,
  UnreadCounterService,
} from "./domain/conversations.domain";
import {
  ConversationReadRepository,
  ConversationRepository,
  MessageRepository,
} from "./infrastructure/conversations.infrastructure";

@Module({
  controllers: [ConversationsController],
  providers: [
    AppLogger,
    DomainEventPublisher,
    ConversationReaderService,
    ConversationArtifactService,
    ConversationCloserService,
    ListConversationsService,
    GetConversationService,
    ListConversationMessagesService,
    MarkConversationReadService,
    ConversationAccessPolicyService,
    ConversationParticipantPolicy,
    UnreadCounterService,
    ConversationRepository,
    ConversationReadRepository,
    MessageRepository,
  ],
  exports: [
    ConversationReaderService,
    ConversationArtifactService,
    ConversationCloserService,
    ConversationAccessPolicyService,
    ConversationRepository,
    ConversationReadRepository,
  ],
})
export class ConversationsModule {}

```

FILE: src/modules/conversations/infrastructure/conversations.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  ConversationRead,
  Match,
  Message,
  ProfilePhoto,
  User,
  UserInterest,
  UserIntent,
  UserLifestyle,
  UserProfile,
} from "../../../generated/prisma/client";

type ConversationExecutor = PrismaService | PrismaTransactionalClient;

export interface ConversationProjection extends Conversation {
  match: Match & {
    userLow: User & {
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
    userHigh: User & {
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
  };
  reads: ConversationRead[];
}

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: ConversationProjection[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeConversationCursor(input.cursor) : null;
    const items = (await this.prisma.conversation.findMany({
      where: {
        match: {
          OR: [{ userLowId: userId }, { userHighId: userId }],
        },
        ...(cursor
          ? {
              OR: [
                {
                  updatedAt: {
                    lt: new Date(cursor.updatedAt),
                  },
                },
                {
                  updatedAt: new Date(cursor.updatedAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      include: conversationInclude(userId),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    })) as unknown as ConversationProjection[];

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeConversationCursor({
              updatedAt: lastItem.updatedAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findByIdForUser(
    conversationId: string,
    userId: string,
    executor?: ConversationExecutor,
  ): Promise<ConversationProjection | null> {
    const db = executor ?? this.prisma;

    return (db.conversation.findFirst({
      where: {
        id: conversationId,
        match: {
          OR: [{ userLowId: userId }, { userHighId: userId }],
        },
      },
      include: conversationInclude(userId),
    })) as unknown as Promise<ConversationProjection | null>;
  }

  async upsertForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
    },
  ): Promise<Conversation> {
    return executor.conversation.upsert({
      where: {
        matchId: input.matchId,
      },
      create: {
        matchId: input.matchId,
      },
      update: {},
    });
  }

  async closeForMatch(
    executor: PrismaTransactionalClient,
    input: {
      matchId: string;
      status: "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
      closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED";
      closedAt: Date;
    },
  ): Promise<Conversation | null> {
    const existing = await executor.conversation.findUnique({
      where: {
        matchId: input.matchId,
      },
    });

    if (!existing) {
      return null;
    }

    return executor.conversation.update({
      where: {
        matchId: input.matchId,
      },
      data: {
        status: input.status,
        closedAt: input.closedAt,
        closedReason: input.closedReason,
      },
    });
  }

  async advanceForNewMessage(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
      lastMessageSentAt: Date;
      lastSenderId: string;
    },
  ): Promise<Pick<Conversation, "id" | "lastMessageSequence">> {
    return executor.conversation.update({
      where: {
        id: input.conversationId,
      },
      data: {
        lastMessageSequence: {
          increment: 1,
        },
        lastMessagePreview: input.lastMessagePreview,
        lastMessageType: input.lastMessageType,
        lastMessageSentAt: input.lastMessageSentAt,
        lastSenderId: input.lastSenderId,
      },
      select: {
        id: true,
        lastMessageSequence: true,
      },
    });
  }

  async updateSummary(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM" | null;
      lastMessageSentAt: Date | null;
      lastSenderId: string | null;
    },
  ): Promise<void> {
    await executor.conversation.update({
      where: {
        id: input.conversationId,
      },
      data: {
        lastMessagePreview: input.lastMessagePreview,
        lastMessageType: input.lastMessageType,
        lastMessageSentAt: input.lastMessageSentAt,
        lastSenderId: input.lastSenderId,
      },
    });
  }
}

@Injectable()
export class ConversationReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertParticipantReadState(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      userId: string;
    },
  ): Promise<ConversationRead> {
    return executor.conversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      create: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
      update: {},
    });
  }

  async updateReadState(
    executor: PrismaTransactionalClient,
    input: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string | null;
      lastReadSequence: number;
      lastReadAt: Date;
    },
  ): Promise<ConversationRead> {
    return executor.conversationRead.update({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      data: {
        lastReadMessageId: input.lastReadMessageId,
        lastReadSequence: input.lastReadSequence,
        lastReadAt: input.lastReadAt,
      },
    });
  }
}

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByConversation(
    conversationId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: Message[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeMessageCursor(input.cursor) : null;
    const items = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              sequence: {
                lt: cursor.sequence,
              },
            }
          : {}),
      },
      orderBy: {
        sequence: "desc",
      },
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeMessageCursor({
              sequence: lastItem.sequence,
            })
          : null,
    };
  }

  async findByConversationAndSequence(
    conversationId: string,
    sequence: number,
    executor?: ConversationExecutor,
  ): Promise<Pick<Message, "id" | "sequence"> | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        conversationId_sequence: {
          conversationId,
          sequence,
        },
      },
      select: {
        id: true,
        sequence: true,
      },
    });
  }
}

export function conversationInclude(userId: string) {
  return {
    reads: {
      where: {
        userId,
      },
    },
    match: {
      include: {
        userLow: userInclude(),
        userHigh: userInclude(),
      },
    },
  };
}

function userInclude() {
  return {
    include: {
      profile: true,
      photos: {
        where: {
          moderationStatus: "APPROVED" as const,
          deletedAt: null,
        },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          objectKey: true,
          bucket: true,
          width: true,
          height: true,
          isPrimary: true,
          position: true,
        },
      },
      lifestyle: true,
      interests: {
        where: {
          deletedAt: null,
        },
        select: {
          interestTagId: true,
          interestTag: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              category: true,
            },
          },
        },
      },
      intents: {
        where: {
          deletedAt: null,
        },
        select: {
          intent: true,
        },
      },
    },
  };
}

function encodeConversationCursor(value: {
  updatedAt: string;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeConversationCursor(cursor: string): {
  updatedAt: string;
  id: string;
} {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      updatedAt?: string;
      id?: string;
    };

    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid conversation cursor");
    }

    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

function encodeMessageCursor(value: { sequence: number }): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeMessageCursor(cursor: string): { sequence: number } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as {
      sequence?: number;
    };

    if (typeof parsed.sequence !== "number") {
      throw new Error("Invalid message cursor");
    }

    return {
      sequence: parsed.sequence,
    };
  } catch {
    throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
  }
}

```

FILE: src/modules/likes/application/likes.services.ts
```ts
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { UserReaderService } from "../../users/application/users.services";
import { InvalidateDiscoverySnapshotService } from "../../discovery/application/discovery.services";
import {
  ConversationReaderService,
} from "../../conversations/application/conversations.services";
import { MATCH_EVENTS } from "../../matches/events/matches.events";
import {
  CreateMatchArtifactsService,
  MatchReaderService,
} from "../../matches/application/matches.services";
import type {
  CreateLikeDto,
  CreateLikeResponseDto,
  LikeDto,
  PassDto,
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
      status: like.status,
      matchedAt: like.matchedAt?.toISOString() ?? null,
      retractedAt: like.retractedAt?.toISOString() ?? null,
      createdAt: like.createdAt.toISOString(),
      updatedAt: like.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class CreateLikeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
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
  ) {}

  async execute(input: {
    userId: string;
    payload: CreateLikeDto;
    metadata: LikeActionMetadata;
    idempotencyKey?: string;
  }): Promise<CreateLikeResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.likePolicyService.assertCanLike(input.userId, input.payload.targetUserId);

    if (input.idempotencyKey) {
      const cached = await this.likeIdempotencyRepository.get<CreateLikeResponseDto>(
        input.userId,
        input.idempotencyKey,
      );
      if (cached) {
        return cached;
      }
    }

    const target = await this.likeInteractionRepository.findLikeTarget(
      input.payload.targetUserId,
    );
    this.likePolicyService.assertTargetEligible(target);

    const hasHistoricalMatch =
      await this.likeInteractionRepository.hasHistoricalMatchBetween(
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

    const existingLike = await this.likeRepository.findByActorAndTarget(
      input.userId,
      input.payload.targetUserId,
    );
    if (existingLike?.status === "MATCHED") {
      const response = await this.buildMatchedResponse(
        existingLike,
        input.userId,
        input.payload.targetUserId,
      );
      await this.persistIdempotentResponse(
        input.userId,
        input.idempotencyKey,
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
        input.idempotencyKey,
        response,
      );
      return response;
    }

    const now = new Date();
    const transactionResult = await withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
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
                  isComplete: true,
                  deletedAt: true,
                },
              },
              photos: {
                where: {
                  deletedAt: null,
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
            });
          } else if (currentLike.status === "RETRACTED") {
            actorLike = await this.likeRepository.reactivate(tx, currentLike.id);
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
            const artifacts = await this.createMatchArtifactsService.execute(tx, {
              actorId: input.userId,
              targetId: input.payload.targetUserId,
              matchedAt: now,
            });

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

    await this.discoveryInvalidationService.execute(input.userId);

    let response: CreateLikeResponseDto;
    if (transactionResult.kind === "match-created") {
      response = await this.buildMatchedResponse(
        transactionResult.like,
        input.userId,
        input.payload.targetUserId,
        transactionResult.matchId,
        transactionResult.conversationId,
      );
      const targetResponse = await this.buildMatchedResponse(
        transactionResult.like,
        input.payload.targetUserId,
        input.userId,
        transactionResult.matchId,
        transactionResult.conversationId,
      );

      await this.discoveryInvalidationService.execute(input.payload.targetUserId);
      await this.domainEventPublisher.publish(MATCH_EVENTS.CREATED, {
        matchId: transactionResult.matchId,
        conversationId: transactionResult.conversationId,
        userIds: [input.userId, input.payload.targetUserId],
        matchByUserId: {
          [input.userId]: response.match,
          [input.payload.targetUserId]: targetResponse.match,
        },
      });
      await this.bullmqProducer.enqueue(
        "notification.dispatch",
        {
          type: "NEW_MATCH",
          recipientUserId: input.payload.targetUserId,
          actorUserId: input.userId,
          matchId: transactionResult.matchId,
          conversationId: transactionResult.conversationId,
        },
        {
          jobId: `notification:new-match:${transactionResult.matchId}:${input.payload.targetUserId}`,
        },
      );
    } else if (transactionResult.kind === "existing-match") {
      response = await this.buildMatchedResponse(
        transactionResult.like,
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
      await this.domainEventPublisher.publish(LIKE_EVENTS.CREATED, {
        likeId: transactionResult.like.id,
        actorId: transactionResult.like.actorId,
        targetId: transactionResult.like.targetId,
      });
    }

    await this.persistIdempotentResponse(
      input.userId,
      input.idempotencyKey,
      response,
    );

    return response;
  }

  private async buildMatchedResponse(
    like: {
      id: string;
      actorId: string;
      targetId: string;
      status: "ACTIVE" | "MATCHED" | "RETRACTED";
      matchedAt: Date | null;
      retractedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
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
        like: this.likeReaderService.mapLike(like),
        match: null,
        conversation: null,
      };
    }

    const matchProjection = await this.matchReaderService.getRequiredMatch(
      match,
      viewerUserId,
    );
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
      like: this.likeReaderService.mapLike(like),
      match: this.matchReaderService.mapSummary(matchProjection, viewerUserId),
      conversation:
        conversation && conversationId
          ? this.conversationReaderService.mapConversationSummary(
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

    await this.likeIdempotencyRepository.set(userId, idempotencyKey, response);
  }
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

    await this.discoveryInvalidationService.execute(input.userId);
  }
}

@Injectable()
export class CreatePassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly passPolicyService: PassPolicyService,
    private readonly likeInteractionRepository: LikeInteractionRepository,
    private readonly passRepository: PassRepository,
    private readonly discoveryInvalidationService: InvalidateDiscoverySnapshotService,
    private readonly auditLogService: AuditLogService,
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

    await this.discoveryInvalidationService.execute(input.userId);

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

    await this.discoveryInvalidationService.execute(input.userId);
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
      if (!isSerializableConflict(error) || attempt >= SERIALIZABLE_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new AppException(500, ERROR_CODES.INTERNAL_ERROR, "Unexpected retry failure");
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

```

FILE: src/modules/sessions/infrastructure/sessions.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { PushToken, UserSession } from "../../../generated/prisma/client";

@Injectable()
export class UserSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(
    userId: string,
    input: {
      cursor?: string;
      limit: number;
    },
  ): Promise<{
    items: UserSession[];
    nextCursor: string | null;
  }> {
    const cursor = input.cursor ? decodeDateIdCursor(input.cursor) : null;
    const items = await this.prisma.userSession.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: new Date(cursor.createdAt),
                  },
                },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });

    const hasMore = items.length > input.limit;
    const pageItems = hasMore ? items.slice(0, input.limit) : items;
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems,
      nextCursor:
        hasMore && lastItem
          ? encodeDateIdCursor({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            })
          : null,
    };
  }

  async findById(sessionId: string): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({
      where: {
        id: sessionId,
      },
    });
  }

  async findLatestActiveByUserAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<UserSession | null> {
    return this.prisma.userSession.findFirst({
      where: {
        userId,
        deviceId,
        deletedAt: null,
        revokedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async touchLastSeen(sessionId: string, now: Date): Promise<void> {
    await this.prisma.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastSeenAt: now,
      },
    });
  }

  async revokeById(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    await executor.userSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        revokedAt: input.now,
        revokedReason: input.reason,
        currentRefreshTokenHash: "",
        previousRefreshTokenHash: null,
        previousRefreshTokenJti: null,
        previousRefreshTokenGraceUntil: null,
      },
    });
  }

  async revokeAllOtherSessions(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      currentSessionId: string;
      now: Date;
    },
  ): Promise<number> {
    const sessions = await executor.userSession.findMany({
      where: {
        userId: input.userId,
        id: {
          not: input.currentSessionId,
        },
        deletedAt: null,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    for (const session of sessions) {
      await executor.userSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: input.now,
          revokedReason: "user_revoked_other_sessions",
          currentRefreshTokenHash: "",
          previousRefreshTokenHash: null,
          previousRefreshTokenJti: null,
          previousRefreshTokenGraceUntil: null,
        },
      });
    }

    return sessions.length;
  }
}

@Injectable()
export class PushTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    executor: PrismaTransactionalClient,
    input: {
      userId: string;
      sessionId: string;
      token: string;
      platform: "IOS" | "ANDROID" | "WEB" | "UNKNOWN";
      provider: "APNS" | "FCM";
      deviceId: string | null;
      now: Date;
    },
  ): Promise<PushToken> {
    return executor.pushToken.upsert({
      where: {
        token: input.token,
      },
      create: {
        userId: input.userId,
        sessionId: input.sessionId,
        token: input.token,
        platform: input.platform,
        provider: input.provider,
        deviceId: input.deviceId,
        lastSeenAt: input.now,
      },
      update: {
        userId: input.userId,
        sessionId: input.sessionId,
        platform: input.platform,
        provider: input.provider,
        deviceId: input.deviceId,
        lastSeenAt: input.now,
        invalidatedAt: null,
        deletedAt: null,
      },
    });
  }

  async findById(pushTokenId: string): Promise<PushToken | null> {
    return this.prisma.pushToken.findUnique({
      where: {
        id: pushTokenId,
      },
    });
  }

  async invalidateById(
    executor: PrismaTransactionalClient,
    pushTokenId: string,
    now: Date,
  ): Promise<void> {
    await executor.pushToken.update({
      where: {
        id: pushTokenId,
      },
      data: {
        invalidatedAt: now,
        deletedAt: now,
      },
    });
  }
}

```

FILE: src/modules/messages/dto/messages.dto.ts
```ts
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import type { MessageDto } from "../../conversations/dto/conversations.dto";

export const MESSAGE_ATTACHMENT_MIME_TYPE_VALUES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
] as const;

export const MESSAGE_ATTACHMENT_TYPE_VALUES = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
] as const;

export type MessageAttachmentMimeTypeValue =
  (typeof MESSAGE_ATTACHMENT_MIME_TYPE_VALUES)[number];
export type MessageAttachmentTypeValue =
  (typeof MESSAGE_ATTACHMENT_TYPE_VALUES)[number];

export class InitiateMessageAttachmentUploadDto {
  @IsUUID("4")
  readonly conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly fileName!: string;

  @IsIn(MESSAGE_ATTACHMENT_MIME_TYPE_VALUES)
  readonly mimeType!: MessageAttachmentMimeTypeValue;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  readonly sizeBytes!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  readonly sha256?: string | null;
}

export interface InitiateMessageAttachmentUploadResponseDto {
  uploadToken: string;
  objectKey: string;
  bucket: string;
  method: "PUT";
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export class CreateConversationMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly clientMessageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly textBody!: string;

  @IsOptional()
  @ValidateIf(({ replyToMessageId }) => replyToMessageId !== null)
  @IsUUID("4")
  readonly replyToMessageId?: string | null;
}

export interface MessageResponseDto {
  message: MessageDto;
}

export class FinalizeMessageAttachmentDto {
  @IsUUID("4")
  readonly conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly clientMessageId!: string;

  @IsIn(MESSAGE_ATTACHMENT_TYPE_VALUES)
  readonly type!: MessageAttachmentTypeValue;

  @IsString()
  @IsNotEmpty()
  readonly uploadToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  readonly objectKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  readonly bucket!: string;

  @IsIn(MESSAGE_ATTACHMENT_MIME_TYPE_VALUES)
  readonly mimeType!: MessageAttachmentMimeTypeValue;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  readonly sizeBytes!: number;

  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @ValidateIf(({ width }) => width !== null && width !== undefined)
  @IsInt()
  @Min(1)
  readonly width?: number | null;

  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @ValidateIf(({ height }) => height !== null && height !== undefined)
  @IsInt()
  @Min(1)
  readonly height?: number | null;

  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @ValidateIf(
    ({ durationSeconds }) =>
      durationSeconds !== null && durationSeconds !== undefined,
  )
  @IsInt()
  @Min(1)
  readonly durationSeconds?: number | null;

  @IsOptional()
  @ValidateIf(({ replyToMessageId }) => replyToMessageId !== null)
  @IsUUID("4")
  readonly replyToMessageId?: string | null;
}

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly textBody!: string;
}

```

FILE: src/modules/messages/events/messages.events.ts
```ts
export const MESSAGE_EVENTS = {
  CREATED: "conversation.message.created",
  UPDATED: "conversation.message.updated",
  DELETED: "conversation.message.deleted",
  TYPING: "message.typing",
} as const;

```

FILE: src/modules/messages/domain/messages.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type {
  Conversation,
  ContentModerationStatus,
  Match,
  Message,
  MessageType,
  User,
} from "../../../generated/prisma/client";
import type {
  FinalizeMessageAttachmentDto,
  InitiateMessageAttachmentUploadDto,
} from "../dto/messages.dto";

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const IMAGE_MAX_SIZE_BYTES = 15 * 1024 * 1024;
const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;
const AUDIO_MAX_SIZE_BYTES = 15 * 1024 * 1024;

type ConversationAccessRecord = Pick<
  Conversation,
  "id" | "status" | "lastMessageSequence"
> & {
  match: Pick<Match, "status" | "userLowId" | "userHighId"> & {
    userLow: Pick<User, "id" | "status" | "deletedAt" | "isChatFrozen">;
    userHigh: Pick<User, "id" | "status" | "deletedAt" | "isChatFrozen">;
  };
};

type MessageOwnershipRecord = Pick<
  Message,
  | "id"
  | "senderId"
  | "conversationId"
  | "type"
  | "status"
  | "createdAt"
  | "sequence"
>;

@Injectable()
export class MessagePolicyService {
  assertConversationWritable(
    conversation: ConversationAccessRecord | null,
    actorUserId: string,
    isBlocked: boolean,
  ): asserts conversation is ConversationAccessRecord {
    if (!conversation) {
      throw new AppException(
        404,
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Conversation not found",
      );
    }

    const participantIds = [
      conversation.match.userLowId,
      conversation.match.userHighId,
    ];
    if (!participantIds.includes(actorUserId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }

    if (conversation.status !== "ACTIVE" || conversation.match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.CONVERSATION_CLOSED,
        "Conversation no longer accepts activity",
      );
    }

    if (isBlocked) {
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Conversation is blocked",
      );
    }

    const actor =
      conversation.match.userLowId === actorUserId
        ? conversation.match.userLow
        : conversation.match.userHigh;
    const otherUser =
      conversation.match.userLowId === actorUserId
        ? conversation.match.userHigh
        : conversation.match.userLow;

    if (actor.deletedAt || actor.status !== "ACTIVE" || actor.isChatFrozen) {
      throw new AppException(
        403,
        ERROR_CODES.FORBIDDEN,
        "Messaging is not allowed for this account",
      );
    }

    if (otherUser.deletedAt || otherUser.status !== "ACTIVE" || otherUser.isChatFrozen) {
      throw new AppException(
        409,
        ERROR_CODES.CONVERSATION_CLOSED,
        "Conversation no longer accepts activity",
      );
    }
  }

  assertTextBody(textBody: string): void {
    if (textBody.trim().length === 0) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_TEXT_REQUIRED,
        "Message text is required",
      );
    }
  }

  assertReplyTargetBelongsToConversation(
    replyTarget:
      | Pick<Message, "id" | "conversationId">
      | null,
    conversationId: string,
  ): void {
    if (!replyTarget || replyTarget.conversationId !== conversationId) {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Reply target is invalid",
      );
    }
  }

  assertEditable(
    message: MessageOwnershipRecord | null,
    actorUserId: string,
    now: Date,
  ): asserts message is MessageOwnershipRecord {
    if (!message) {
      throw new AppException(
        404,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    if (message.senderId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.MESSAGE_NOT_OWNED,
        "Message belongs to another sender",
      );
    }

    if (message.status === "DELETED_BY_SENDER" || message.status === "REMOVED_BY_MODERATION") {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_ALREADY_DELETED,
        "Message was already deleted",
      );
    }

    if (message.type !== "TEXT") {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_EDIT_WINDOW_EXPIRED,
        "Only text messages can be edited",
      );
    }

    if (now.getTime() - message.createdAt.getTime() > MESSAGE_EDIT_WINDOW_MS) {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_EDIT_WINDOW_EXPIRED,
        "Message can no longer be edited",
      );
    }
  }

  assertDeletable(
    message: MessageOwnershipRecord | null,
    actorUserId: string,
  ): asserts message is MessageOwnershipRecord {
    if (!message) {
      throw new AppException(
        404,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    if (message.senderId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.MESSAGE_NOT_OWNED,
        "Message belongs to another sender",
      );
    }

    if (message.status === "DELETED_BY_SENDER" || message.status === "REMOVED_BY_MODERATION") {
      throw new AppException(
        409,
        ERROR_CODES.MESSAGE_ALREADY_DELETED,
        "Message was already deleted",
      );
    }
  }
}

@Injectable()
export class MessageSequenceService {
  nextValue(currentLastSequence: number): number {
    return currentLastSequence + 1;
  }
}

@Injectable()
export class AttachmentPolicyService {
  private readonly mimeTypeToType: Record<string, "IMAGE" | "VIDEO" | "AUDIO"> = {
    "image/jpeg": "IMAGE",
    "image/png": "IMAGE",
    "image/webp": "IMAGE",
    "video/mp4": "VIDEO",
    "video/quicktime": "VIDEO",
    "audio/mpeg": "AUDIO",
    "audio/mp4": "AUDIO",
    "audio/aac": "AUDIO",
    "audio/wav": "AUDIO",
  };

  assertUploadAllowed(input: InitiateMessageAttachmentUploadDto): void {
    const derivedType = this.mimeTypeToType[input.mimeType];
    if (!derivedType) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_INVALID_TYPE,
        "Attachment type is invalid",
      );
    }

    this.assertMaxSize(derivedType, input.sizeBytes);
  }

  assertFinalizeAllowed(input: FinalizeMessageAttachmentDto): void {
    const derivedType = this.mimeTypeToType[input.mimeType];
    if (!derivedType || derivedType !== input.type) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_INVALID_TYPE,
        "Attachment type is invalid",
      );
    }

    this.assertMaxSize(input.type, input.sizeBytes);

    if ((input.type === "IMAGE" || input.type === "VIDEO") && (!input.width || !input.height)) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_REQUIRED,
        "Attachment dimensions are required",
      );
    }

    if ((input.type === "VIDEO" || input.type === "AUDIO") && !input.durationSeconds) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_REQUIRED,
        "Attachment duration is required",
      );
    }
  }

  resolveAttachmentStatus(): {
    status: "PENDING_MODERATION";
    moderationStatus: ContentModerationStatus;
  } {
    return {
      status: "PENDING_MODERATION",
      moderationStatus: "PENDING",
    };
  }

  resolveObjectExtension(fileName: string, mimeType: string): string {
    const trimmed = fileName.trim().toLowerCase();
    if (trimmed.endsWith(".jpg") || trimmed.endsWith(".jpeg")) {
      return ".jpg";
    }
    if (trimmed.endsWith(".png")) {
      return ".png";
    }
    if (trimmed.endsWith(".webp")) {
      return ".webp";
    }
    if (trimmed.endsWith(".mp4")) {
      return ".mp4";
    }
    if (trimmed.endsWith(".mov")) {
      return ".mov";
    }
    if (trimmed.endsWith(".mp3")) {
      return ".mp3";
    }
    if (trimmed.endsWith(".m4a")) {
      return ".m4a";
    }
    if (trimmed.endsWith(".aac")) {
      return ".aac";
    }
    if (trimmed.endsWith(".wav")) {
      return ".wav";
    }

    switch (mimeType) {
      case "image/jpeg":
        return ".jpg";
      case "image/png":
        return ".png";
      case "image/webp":
        return ".webp";
      case "video/mp4":
        return ".mp4";
      case "video/quicktime":
        return ".mov";
      case "audio/mpeg":
        return ".mp3";
      case "audio/mp4":
        return ".m4a";
      case "audio/aac":
        return ".aac";
      case "audio/wav":
        return ".wav";
      default:
        return "";
    }
  }

  private assertMaxSize(type: "IMAGE" | "VIDEO" | "AUDIO", sizeBytes: number): void {
    const maxBytes =
      type === "IMAGE"
        ? IMAGE_MAX_SIZE_BYTES
        : type === "VIDEO"
          ? VIDEO_MAX_SIZE_BYTES
          : AUDIO_MAX_SIZE_BYTES;

    if (sizeBytes > maxBytes) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_TOO_LARGE,
        "Attachment exceeds the supported size",
      );
    }
  }
}

```

FILE: src/modules/messages/policies/message-sender.policy.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Message } from "../../../generated/prisma/client";

@Injectable()
export class MessageSenderPolicy {
  assertOwnedBySender(
    message: Pick<Message, "senderId"> | null,
    actorUserId: string,
  ): void {
    if (!message) {
      throw new AppException(
        404,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    if (message.senderId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.MESSAGE_NOT_OWNED,
        "Message belongs to another sender",
      );
    }
  }
}

```

FILE: src/modules/messages/policies/conversation-message.policy.ts
```ts
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Match } from "../../../generated/prisma/client";

@Injectable()
export class ConversationMessagePolicy {
  assertParticipant(
    userId: string,
    match: Pick<Match, "userLowId" | "userHighId"> | null,
  ): void {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }
  }
}

```

FILE: src/modules/messages/infrastructure/messages.infrastructure.ts
```ts
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  Conversation,
  Match,
  Message,
  User,
} from "../../../generated/prisma/client";

type MessageExecutor = PrismaService | PrismaTransactionalClient;

export interface MessageAccessRecord extends Message {
  conversation: Conversation & {
    match: Match & {
      userLow: Pick<User, "id" | "status" | "deletedAt" | "isChatFrozen">;
      userHigh: Pick<User, "id" | "status" | "deletedAt" | "isChatFrozen">;
    };
  };
}

export interface MessageAttachmentUploadIntent {
  userId: string;
  conversationId: string;
  uploadToken: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string | null;
  expiresAt: string;
}

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    messageId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        id: messageId,
      },
    });
  }

  async findAccessRecordById(
    messageId: string,
    executor?: MessageExecutor,
  ): Promise<MessageAccessRecord | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        id: messageId,
      },
      include: {
        conversation: {
          include: {
            match: {
              include: {
                userLow: {
                  select: {
                    id: true,
                    status: true,
                    deletedAt: true,
                    isChatFrozen: true,
                  },
                },
                userHigh: {
                  select: {
                    id: true,
                    status: true,
                    deletedAt: true,
                    isChatFrozen: true,
                  },
                },
              },
            },
          },
        },
      },
    }) as Promise<MessageAccessRecord | null>;
  }

  async findByConversationAndClientMessageId(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findUnique({
      where: {
        conversationId_senderId_clientMessageId: {
          conversationId,
          senderId,
          clientMessageId,
        },
      },
    });
  }

  async findByConversationAndId(
    conversationId: string,
    messageId: string,
    executor?: MessageExecutor,
  ): Promise<Pick<Message, "id" | "conversationId"> | null> {
    const db = executor ?? this.prisma;

    return db.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        conversationId: true,
      },
    });
  }

  async create(
    executor: PrismaTransactionalClient,
    data: {
      conversationId: string;
      senderId: string;
      sequence: number;
      clientMessageId: string;
      type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
      textBody: string | null;
      attachmentObjectKey?: string | null;
      attachmentBucket?: string | null;
      attachmentMimeType?: string | null;
      attachmentSizeBytes?: number | null;
      attachmentWidth?: number | null;
      attachmentHeight?: number | null;
      attachmentDurationSeconds?: number | null;
      attachmentModerationStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
      status?: "ACTIVE" | "PENDING_MODERATION";
      replyToMessageId?: string | null;
    },
  ): Promise<Message> {
    return executor.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        sequence: data.sequence,
        clientMessageId: data.clientMessageId,
        type: data.type,
        textBody: data.textBody,
        attachmentObjectKey: data.attachmentObjectKey ?? null,
        attachmentBucket: data.attachmentBucket ?? null,
        attachmentMimeType: data.attachmentMimeType ?? null,
        attachmentSizeBytes: data.attachmentSizeBytes ?? null,
        attachmentWidth: data.attachmentWidth ?? null,
        attachmentHeight: data.attachmentHeight ?? null,
        attachmentDurationSeconds: data.attachmentDurationSeconds ?? null,
        attachmentModerationStatus: data.attachmentModerationStatus ?? null,
        status: data.status ?? "ACTIVE",
        replyToMessageId: data.replyToMessageId ?? null,
      },
    });
  }

  async updateText(
    executor: PrismaTransactionalClient,
    input: {
      messageId: string;
      textBody: string;
      editedAt: Date;
    },
  ): Promise<Message> {
    return executor.message.update({
      where: {
        id: input.messageId,
      },
      data: {
        textBody: input.textBody,
        editedAt: input.editedAt,
      },
    });
  }

  async markDeleted(
    executor: PrismaTransactionalClient,
    input: {
      messageId: string;
      deletedAt: Date;
    },
  ): Promise<Message> {
    return executor.message.update({
      where: {
        id: input.messageId,
      },
      data: {
        status: "DELETED_BY_SENDER",
        deletedAt: input.deletedAt,
      },
    });
  }

  async findLatestByConversation(
    conversationId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findFirst({
      where: {
        conversationId,
      },
      orderBy: {
        sequence: "desc",
      },
    });
  }

  async findLatestVisibleByConversation(
    conversationId: string,
    executor?: MessageExecutor,
  ): Promise<Message | null> {
    const db = executor ?? this.prisma;

    return db.message.findFirst({
      where: {
        conversationId,
        status: {
          in: ["ACTIVE", "PENDING_MODERATION"],
        },
      },
      orderBy: {
        sequence: "desc",
      },
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}

@Injectable()
export class MessageInteractionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveBlockBetween(
    actorId: string,
    targetId: string,
    executor?: MessageExecutor,
  ): Promise<boolean> {
    const db = executor ?? this.prisma;
    const count = await db.block.count({
      where: {
        deletedAt: null,
        OR: [
          {
            blockerId: actorId,
            blockedId: targetId,
          },
          {
            blockerId: targetId,
            blockedId: actorId,
          },
        ],
      },
    });

    return count > 0;
  }
}

@Injectable()
export class MessageAttachmentUploadStateStore {
  private static readonly KEY_PREFIX = "message-attachment-upload:";

  constructor(private readonly redis: RedisService) {}

  async save(
    input: MessageAttachmentUploadIntent,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      `${MessageAttachmentUploadStateStore.KEY_PREFIX}${input.uploadToken}`,
      JSON.stringify(input),
      "EX",
      ttlSeconds,
    );
  }

  async get(uploadToken: string): Promise<MessageAttachmentUploadIntent | null> {
    const raw = await this.redis.get(
      `${MessageAttachmentUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as MessageAttachmentUploadIntent;
  }

  async delete(uploadToken: string): Promise<void> {
    await this.redis.del(
      `${MessageAttachmentUploadStateStore.KEY_PREFIX}${uploadToken}`,
    );
  }
}

```

FILE: src/modules/messages/application/messages.services.ts
```ts
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import objectStorageConfig from "../../../config/object-storage.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { randomBase64Url } from "../../../common/utils/crypto.util";
import {
  resolveConversationPreview,
  resolveVisibleAttachment,
  resolveVisibleTextBody,
} from "../../../common/utils/message-visibility.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import type { Message } from "../../../generated/prisma/client";
import { UserReaderService } from "../../users/application/users.services";
import type { MessageDto } from "../../conversations/dto/conversations.dto";
import {
  ConversationReadRepository,
  ConversationRepository,
  type ConversationProjection,
} from "../../conversations/infrastructure/conversations.infrastructure";
import {
  AttachmentPolicyService,
  MessagePolicyService,
  MessageSequenceService,
} from "../domain/messages.domain";
import type {
  CreateConversationMessageDto,
  FinalizeMessageAttachmentDto,
  InitiateMessageAttachmentUploadDto,
  InitiateMessageAttachmentUploadResponseDto,
  MessageResponseDto,
  UpdateMessageDto,
} from "../dto/messages.dto";
import { MESSAGE_EVENTS } from "../events/messages.events";
import {
  MessageAttachmentUploadStateStore,
  MessageInteractionRepository,
  MessageRepository,
} from "../infrastructure/messages.infrastructure";

const MESSAGE_ATTACHMENT_UPLOAD_TTL_SECONDS = 15 * 60;

export interface MessageActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

interface MessageEventPayloadByUser {
  [userId: string]: MessageDto;
}

@Injectable()
export class MessageReaderService {
  mapMessage(message: Message, viewerUserId: string): MessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sequence: message.sequence,
      clientMessageId: message.clientMessageId ?? null,
      type: message.type,
      textBody: resolveVisibleTextBody(message),
      attachment: resolveVisibleAttachment(message, viewerUserId),
      status: message.status,
      replyToMessageId: message.replyToMessageId ?? null,
      editedAt: message.editedAt?.toISOString() ?? null,
      deletedAt: message.deletedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class MessageDispatchService {
  constructor(
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async emitCreated(input: {
    conversationId: string;
    recipientUserIds: string[];
    messageByUserId: MessageEventPayloadByUser;
  }): Promise<void> {
    await this.domainEventPublisher.publish(MESSAGE_EVENTS.CREATED, input);
  }

  async emitUpdated(input: {
    conversationId: string;
    recipientUserIds: string[];
    messageByUserId: MessageEventPayloadByUser;
  }): Promise<void> {
    await this.domainEventPublisher.publish(MESSAGE_EVENTS.UPDATED, input);
  }

  async emitDeleted(input: {
    conversationId: string;
    recipientUserIds: string[];
    messageId: string;
    sequence: number;
    status: "DELETED_BY_SENDER" | "REMOVED_BY_MODERATION";
    deletedAt: string;
  }): Promise<void> {
    await this.domainEventPublisher.publish(MESSAGE_EVENTS.DELETED, input);
  }

  async emitTyping(input: {
    conversationId: string;
    userId: string;
    recipientUserIds: string[];
    isTyping: boolean;
    expiresAt: string;
  }): Promise<void> {
    await this.domainEventPublisher.publish(MESSAGE_EVENTS.TYPING, input);
  }
}

@Injectable()
export class ConversationMessageSummaryService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  async recompute(
    executor: import("../../../database/prisma/prisma.transaction").PrismaTransactionalClient,
    conversationId: string,
  ): Promise<void> {
    const latestVisible = await this.messageRepository.findLatestVisibleByConversation(
      conversationId,
      executor,
    );
    const latestSource =
      latestVisible ??
      (await this.messageRepository.findLatestByConversation(
        conversationId,
        executor,
      ));

    if (!latestSource) {
      await this.conversationRepository.updateSummary(executor, {
        conversationId,
        lastMessagePreview: null,
        lastMessageType: null,
        lastMessageSentAt: null,
        lastSenderId: null,
      });
      return;
    }

    const preview = resolveConversationPreview(latestSource);
    await this.conversationRepository.updateSummary(executor, {
      conversationId,
      lastMessagePreview: preview.preview,
      lastMessageType: preview.type,
      lastMessageSentAt: preview.sentAt,
      lastSenderId: preview.senderId,
    });
  }
}

@Injectable()
export class InitiateMessageAttachmentUploadService {
  constructor(
    private readonly userReaderService: UserReaderService,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly attachmentPolicyService: AttachmentPolicyService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly attachmentUploadStateStore: MessageAttachmentUploadStateStore,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: InitiateMessageAttachmentUploadDto;
  }): Promise<InitiateMessageAttachmentUploadResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.attachmentPolicyService.assertUploadAllowed(input.payload);

    const conversation = await this.getWritableConversation(
      input.payload.conversationId,
      input.userId,
    );

    const uploadToken = randomBase64Url(32);
    const objectKey = buildMessageAttachmentObjectKey(
      input.userId,
      input.payload.conversationId,
      input.payload.fileName,
      input.payload.mimeType,
      this.attachmentPolicyService,
    );

    const instruction = await this.objectStorageService.createPresignedPutObject({
      bucket: this.storageConfig.bucketMessageAttachments,
      objectKey,
      mimeType: input.payload.mimeType,
      uploadToken,
      userId: input.userId,
      sha256: input.payload.sha256 ?? null,
      expiresInSeconds: MESSAGE_ATTACHMENT_UPLOAD_TTL_SECONDS,
    });

    await this.attachmentUploadStateStore.save(
      {
        userId: input.userId,
        conversationId: conversation.id,
        uploadToken,
        bucket: this.storageConfig.bucketMessageAttachments,
        objectKey,
        fileName: input.payload.fileName,
        mimeType: input.payload.mimeType,
        sizeBytes: input.payload.sizeBytes,
        sha256: input.payload.sha256 ?? null,
        expiresAt: instruction.expiresAt.toISOString(),
      },
      MESSAGE_ATTACHMENT_UPLOAD_TTL_SECONDS,
    );

    return {
      uploadToken,
      objectKey,
      bucket: this.storageConfig.bucketMessageAttachments,
      method: "PUT",
      uploadUrl: instruction.uploadUrl,
      headers: instruction.headers,
      expiresAt: instruction.expiresAt.toISOString(),
    };
  }

  private async getWritableConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationProjection> {
    const conversation = await this.conversationRepository.findByIdForUser(
      conversationId,
      userId,
    );
    const participantIds = resolveParticipantIds(conversation);
    const otherUserId = participantIds.find((id) => id !== userId) ?? userId;
    const blocked = conversation
      ? await this.messageInteractionRepository.hasActiveBlockBetween(
          userId,
          otherUserId,
        )
      : false;

    this.messagePolicyService.assertConversationWritable(
      conversation,
      userId,
      blocked,
    );

    return conversation;
  }
}

@Injectable()
export class SendMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly messageSequenceService: MessageSequenceService,
    private readonly messageReaderService: MessageReaderService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
    payload: CreateConversationMessageDto;
    metadata: MessageActionMetadata;
  }): Promise<MessageResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.messagePolicyService.assertTextBody(input.payload.textBody);

    const existing = await this.messageRepository.findByConversationAndClientMessageId(
      input.conversationId,
      input.userId,
      input.payload.clientMessageId,
    );
    if (existing) {
      return {
        message: this.messageReaderService.mapMessage(existing, input.userId),
      };
    }

    const now = new Date();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const conversation = await this.conversationRepository.findByIdForUser(
          input.conversationId,
          input.userId,
          tx,
        );
        const participantIds = resolveParticipantIds(conversation);
        const otherUserId = participantIds.find((id) => id !== input.userId) ?? input.userId;
        const blocked = conversation
          ? await this.messageInteractionRepository.hasActiveBlockBetween(
              input.userId,
              otherUserId,
              tx,
            )
          : false;

        this.messagePolicyService.assertConversationWritable(
          conversation,
          input.userId,
          blocked,
        );

        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.conversationId,
            input.userId,
            input.payload.clientMessageId,
            tx,
          );
        if (duplicate) {
          return {
            message: duplicate,
            participantIds,
            created: false,
          };
        }

        if (input.payload.replyToMessageId) {
          const replyTarget = await this.messageRepository.findByConversationAndId(
            input.conversationId,
            input.payload.replyToMessageId,
            tx,
          );
          this.messagePolicyService.assertReplyTargetBelongsToConversation(
            replyTarget,
            input.conversationId,
          );
        }

        const previewSource = {
          senderId: input.userId,
          type: "TEXT" as const,
          textBody: input.payload.textBody,
          attachmentObjectKey: null,
          attachmentBucket: null,
          attachmentMimeType: null,
          attachmentSizeBytes: null,
          attachmentWidth: null,
          attachmentHeight: null,
          attachmentDurationSeconds: null,
          attachmentModerationStatus: null,
          status: "ACTIVE" as const,
          createdAt: now,
        };
        const preview = resolveConversationPreview(previewSource);
        const advanced = await this.conversationRepository.advanceForNewMessage(tx, {
          conversationId: input.conversationId,
          lastMessagePreview: preview.preview,
          lastMessageType: preview.type,
          lastMessageSentAt: preview.sentAt,
          lastSenderId: preview.senderId,
        });

        const sequence = advanced.lastMessageSequence;
        const message = await this.messageRepository.create(tx, {
          conversationId: input.conversationId,
          senderId: input.userId,
          sequence,
          clientMessageId: input.payload.clientMessageId,
          type: "TEXT",
          textBody: input.payload.textBody.trim(),
          replyToMessageId: input.payload.replyToMessageId ?? null,
        });

        await this.conversationReadRepository.updateReadState(tx, {
          conversationId: input.conversationId,
          userId: input.userId,
          lastReadMessageId: message.id,
          lastReadSequence: sequence,
          lastReadAt: now,
        });

        await this.auditLogService.write(
          {
            actorUserId: input.userId,
            action: "message.send",
            entityType: "Message",
            entityId: message.id,
            targetUserId: otherUserId,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
            metadata: {
              conversationId: input.conversationId,
              sequence,
            },
          },
          tx,
        );

        return {
          message,
          participantIds,
          created: true,
        };
      });

      if (result.created) {
        await this.messageDispatchService.emitCreated({
          conversationId: result.message.conversationId,
          recipientUserIds: result.participantIds,
          messageByUserId: buildMessageByUserId(
            result.message,
            result.participantIds,
            this.messageReaderService,
          ),
        });
      }

      return {
        message: this.messageReaderService.mapMessage(result.message, input.userId),
      };
    } catch (error) {
      if (this.messageRepository.isUniqueConstraintError(error)) {
        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.conversationId,
            input.userId,
            input.payload.clientMessageId,
          );
        if (duplicate) {
          return {
            message: this.messageReaderService.mapMessage(duplicate, input.userId),
          };
        }
      }

      throw error;
    }
  }
}

@Injectable()
export class FinalizeAttachmentMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userReaderService: UserReaderService,
    private readonly conversationRepository: ConversationRepository,
    private readonly conversationReadRepository: ConversationReadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly attachmentPolicyService: AttachmentPolicyService,
    private readonly messageReaderService: MessageReaderService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly attachmentUploadStateStore: MessageAttachmentUploadStateStore,
    private readonly objectStorageService: ObjectStorageService,
    private readonly auditLogService: AuditLogService,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
  ) {}

  async execute(input: {
    userId: string;
    payload: FinalizeMessageAttachmentDto;
    metadata: MessageActionMetadata;
  }): Promise<MessageResponseDto> {
    await this.userReaderService.getRequiredById(input.userId);
    this.attachmentPolicyService.assertFinalizeAllowed(input.payload);

    const existing = await this.messageRepository.findByConversationAndClientMessageId(
      input.payload.conversationId,
      input.userId,
      input.payload.clientMessageId,
    );
    if (existing) {
      return {
        message: this.messageReaderService.mapMessage(existing, input.userId),
      };
    }

    const uploadState = await this.attachmentUploadStateStore.get(
      input.payload.uploadToken,
    );
    if (!uploadState) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
        "Attachment upload is invalid or expired",
      );
    }

    if (input.payload.bucket !== this.storageConfig.bucketMessageAttachments) {
      throw new AppException(
        400,
        ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
        "Attachment bucket is invalid",
      );
    }

    assertAttachmentUploadMatches(uploadState, input.userId, input.payload);

    const headedObject = await this.objectStorageService.headObject({
      bucket: input.payload.bucket,
      objectKey: input.payload.objectKey,
    });
    assertHeadedAttachmentMatches(headedObject, uploadState, input.payload);

    const now = new Date();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const conversation = await this.conversationRepository.findByIdForUser(
          input.payload.conversationId,
          input.userId,
          tx,
        );
        const participantIds = resolveParticipantIds(conversation);
        const otherUserId = participantIds.find((id) => id !== input.userId) ?? input.userId;
        const blocked = conversation
          ? await this.messageInteractionRepository.hasActiveBlockBetween(
              input.userId,
              otherUserId,
              tx,
            )
          : false;

        this.messagePolicyService.assertConversationWritable(
          conversation,
          input.userId,
          blocked,
        );

        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.payload.conversationId,
            input.userId,
            input.payload.clientMessageId,
            tx,
          );
        if (duplicate) {
          return {
            message: duplicate,
            participantIds,
            created: false,
          };
        }

        if (input.payload.replyToMessageId) {
          const replyTarget = await this.messageRepository.findByConversationAndId(
            input.payload.conversationId,
            input.payload.replyToMessageId,
            tx,
          );
          this.messagePolicyService.assertReplyTargetBelongsToConversation(
            replyTarget,
            input.payload.conversationId,
          );
        }

        const status = this.attachmentPolicyService.resolveAttachmentStatus();
        const previewSource = {
          senderId: input.userId,
          type: input.payload.type,
          textBody: null,
          attachmentObjectKey: input.payload.objectKey,
          attachmentBucket: input.payload.bucket,
          attachmentMimeType: input.payload.mimeType,
          attachmentSizeBytes: input.payload.sizeBytes,
          attachmentWidth: input.payload.width ?? null,
          attachmentHeight: input.payload.height ?? null,
          attachmentDurationSeconds: input.payload.durationSeconds ?? null,
          attachmentModerationStatus: status.moderationStatus,
          status: status.status,
          createdAt: now,
        };
        const preview = resolveConversationPreview(previewSource);
        const advanced = await this.conversationRepository.advanceForNewMessage(tx, {
          conversationId: input.payload.conversationId,
          lastMessagePreview: preview.preview,
          lastMessageType: preview.type,
          lastMessageSentAt: preview.sentAt,
          lastSenderId: preview.senderId,
        });

        const message = await this.messageRepository.create(tx, {
          conversationId: input.payload.conversationId,
          senderId: input.userId,
          sequence: advanced.lastMessageSequence,
          clientMessageId: input.payload.clientMessageId,
          type: input.payload.type,
          textBody: null,
          attachmentObjectKey: input.payload.objectKey,
          attachmentBucket: input.payload.bucket,
          attachmentMimeType: input.payload.mimeType,
          attachmentSizeBytes: input.payload.sizeBytes,
          attachmentWidth: input.payload.width ?? null,
          attachmentHeight: input.payload.height ?? null,
          attachmentDurationSeconds: input.payload.durationSeconds ?? null,
          attachmentModerationStatus: status.moderationStatus,
          status: status.status,
          replyToMessageId: input.payload.replyToMessageId ?? null,
        });

        await this.conversationReadRepository.updateReadState(tx, {
          conversationId: input.payload.conversationId,
          userId: input.userId,
          lastReadMessageId: message.id,
          lastReadSequence: message.sequence,
          lastReadAt: now,
        });

        await this.auditLogService.write(
          {
            actorUserId: input.userId,
            action: "message.attachment.finalize",
            entityType: "Message",
            entityId: message.id,
            targetUserId: otherUserId,
            ipAddress: input.metadata.ipAddress,
            userAgent: input.metadata.userAgent,
            metadata: {
              conversationId: input.payload.conversationId,
              objectKey: input.payload.objectKey,
              type: input.payload.type,
            },
          },
          tx,
        );

        return {
          message,
          participantIds,
          created: true,
        };
      });

      await this.attachmentUploadStateStore.delete(input.payload.uploadToken);

      if (result.created) {
        await this.messageDispatchService.emitCreated({
          conversationId: result.message.conversationId,
          recipientUserIds: result.participantIds,
          messageByUserId: buildMessageByUserId(
            result.message,
            result.participantIds,
            this.messageReaderService,
          ),
        });
      }

      return {
        message: this.messageReaderService.mapMessage(result.message, input.userId),
      };
    } catch (error) {
      if (this.messageRepository.isUniqueConstraintError(error)) {
        const duplicate =
          await this.messageRepository.findByConversationAndClientMessageId(
            input.payload.conversationId,
            input.userId,
            input.payload.clientMessageId,
          );
        if (duplicate) {
          await this.attachmentUploadStateStore.delete(input.payload.uploadToken);
          return {
            message: this.messageReaderService.mapMessage(duplicate, input.userId),
          };
        }
      }

      throw error;
    }
  }
}

@Injectable()
export class EditMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRepository: MessageRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly messageReaderService: MessageReaderService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly conversationSummaryService: ConversationMessageSummaryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    messageId: string;
    payload: UpdateMessageDto;
    metadata: MessageActionMetadata;
  }): Promise<MessageResponseDto> {
    this.messagePolicyService.assertTextBody(input.payload.textBody);

    const initial = await this.messageRepository.findAccessRecordById(input.messageId);
    const now = new Date();
    this.messagePolicyService.assertEditable(initial, input.userId, now);

    const otherUserId = resolveOtherParticipantId(initial.conversation.match, input.userId);
    const blocked = await this.messageInteractionRepository.hasActiveBlockBetween(
      input.userId,
      otherUserId,
    );
    this.messagePolicyService.assertConversationWritable(
      initial.conversation,
      input.userId,
      blocked,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.messageRepository.findAccessRecordById(
        input.messageId,
        tx,
      );
      const txOtherUserId = resolveOtherParticipantId(current!.conversation.match, input.userId);
      const txBlocked = await this.messageInteractionRepository.hasActiveBlockBetween(
        input.userId,
        txOtherUserId,
        tx,
      );

      this.messagePolicyService.assertEditable(current, input.userId, now);
      this.messagePolicyService.assertConversationWritable(
        current.conversation,
        input.userId,
        txBlocked,
      );

      const updated = await this.messageRepository.updateText(tx, {
        messageId: input.messageId,
        textBody: input.payload.textBody.trim(),
        editedAt: now,
      });

      await this.conversationSummaryService.recompute(
        tx,
        updated.conversationId,
      );

      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "message.edit",
          entityType: "Message",
          entityId: updated.id,
          targetUserId: txOtherUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            conversationId: updated.conversationId,
          },
        },
        tx,
      );

      return {
        message: updated,
        participantIds: [
          current!.conversation.match.userLowId,
          current!.conversation.match.userHighId,
        ],
      };
    });

    await this.messageDispatchService.emitUpdated({
      conversationId: result.message.conversationId,
      recipientUserIds: result.participantIds,
      messageByUserId: buildMessageByUserId(
        result.message,
        result.participantIds,
        this.messageReaderService,
      ),
    });

    return {
      message: this.messageReaderService.mapMessage(result.message, input.userId),
    };
  }
}

@Injectable()
export class DeleteMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageRepository: MessageRepository,
    private readonly messagePolicyService: MessagePolicyService,
    private readonly conversationSummaryService: ConversationMessageSummaryService,
    private readonly messageDispatchService: MessageDispatchService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    userId: string;
    messageId: string;
    metadata: MessageActionMetadata;
  }): Promise<void> {
    const existing = await this.messageRepository.findAccessRecordById(input.messageId);
    this.messagePolicyService.assertDeletable(existing, input.userId);

    const deletedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.messageRepository.findAccessRecordById(
        input.messageId,
        tx,
      );
      this.messagePolicyService.assertDeletable(current, input.userId);

      const deleted = await this.messageRepository.markDeleted(tx, {
        messageId: input.messageId,
        deletedAt,
      });

      await this.conversationSummaryService.recompute(
        tx,
        deleted.conversationId,
      );

      const otherUserId = resolveOtherParticipantId(current!.conversation.match, input.userId);
      await this.auditLogService.write(
        {
          actorUserId: input.userId,
          action: "message.delete",
          entityType: "Message",
          entityId: deleted.id,
          targetUserId: otherUserId,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            conversationId: deleted.conversationId,
            sequence: deleted.sequence,
          },
        },
        tx,
      );

      return {
        deleted,
        participantIds: [
          current!.conversation.match.userLowId,
          current!.conversation.match.userHighId,
        ],
      };
    });

    await this.messageDispatchService.emitDeleted({
      conversationId: result.deleted.conversationId,
      recipientUserIds: result.participantIds,
      messageId: result.deleted.id,
      sequence: result.deleted.sequence,
      status: "DELETED_BY_SENDER",
      deletedAt: result.deleted.deletedAt?.toISOString() ?? deletedAt.toISOString(),
    });
  }
}

@Injectable()
export class EmitTypingIndicatorService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageInteractionRepository: MessageInteractionRepository,
    private readonly messagePolicyService: MessagePolicyService,
  ) {}

  async execute(input: {
    userId: string;
    conversationId: string;
  }): Promise<{
    recipientUserIds: string[];
  }> {
    const conversation = await this.conversationRepository.findByIdForUser(
      input.conversationId,
      input.userId,
    );
    const participantIds = resolveParticipantIds(conversation);
    const otherUserId = participantIds.find((id) => id !== input.userId) ?? input.userId;
    const blocked = conversation
      ? await this.messageInteractionRepository.hasActiveBlockBetween(
          input.userId,
          otherUserId,
        )
      : false;

    this.messagePolicyService.assertConversationWritable(
      conversation,
      input.userId,
      blocked,
    );

    return {
      recipientUserIds: participantIds.filter((id) => id !== input.userId),
    };
  }
}

function buildMessageAttachmentObjectKey(
  userId: string,
  conversationId: string,
  fileName: string,
  mimeType: string,
  attachmentPolicyService: AttachmentPolicyService,
): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = attachmentPolicyService.resolveObjectExtension(
    fileName,
    mimeType,
  );

  return `${conversationId}/${userId}/${year}/${month}/${randomUUID()}${extension}`;
}

function buildMessageByUserId(
  message: Message,
  participantIds: string[],
  messageReaderService: MessageReaderService,
): MessageEventPayloadByUser {
  return participantIds.reduce<MessageEventPayloadByUser>((accumulator, userId) => {
    accumulator[userId] = messageReaderService.mapMessage(message, userId);
    return accumulator;
  }, {});
}

function resolveParticipantIds(
  conversation: ConversationProjection | null,
): string[] {
  if (!conversation) {
    return [];
  }

  return [conversation.match.userLowId, conversation.match.userHighId];
}

function resolveOtherParticipantId(
  match: { userLowId: string; userHighId: string },
  actorUserId: string,
): string {
  return match.userLowId === actorUserId ? match.userHighId : match.userLowId;
}

function assertAttachmentUploadMatches(
  uploadState: {
    userId: string;
    conversationId: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
  },
  userId: string,
  payload: FinalizeMessageAttachmentDto,
): void {
  if (
    uploadState.userId !== userId ||
    uploadState.conversationId !== payload.conversationId ||
    uploadState.bucket !== payload.bucket ||
    uploadState.objectKey !== payload.objectKey ||
    uploadState.mimeType !== payload.mimeType ||
    uploadState.sizeBytes !== payload.sizeBytes
  ) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Attachment upload does not match the initiated upload",
    );
  }
}

function assertHeadedAttachmentMatches(
  head: {
    sizeBytes: number | null;
    mimeType: string | null;
    metadata: Record<string, string>;
  },
  uploadState: {
    uploadToken: string;
    userId: string;
    sha256: string | null;
  },
  payload: FinalizeMessageAttachmentDto,
): void {
  if (head.sizeBytes !== payload.sizeBytes || head.mimeType !== payload.mimeType) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Uploaded attachment metadata does not match the expected file",
    );
  }

  if (
    head.metadata["aroha-user-id"] !== uploadState.userId ||
    head.metadata["aroha-upload-token"] !== uploadState.uploadToken
  ) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Uploaded attachment ownership metadata is invalid",
    );
  }

  if ((uploadState.sha256 ?? null) !== (head.metadata["aroha-sha256"] ?? null)) {
    throw new AppException(
      400,
      ERROR_CODES.MESSAGE_ATTACHMENT_UPLOAD_INVALID,
      "Uploaded attachment checksum is invalid",
    );
  }
}

```

FILE: src/modules/messages/controllers/messages.controller.ts
```ts
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  CreateConversationMessageDto,
  FinalizeMessageAttachmentDto,
  InitiateMessageAttachmentUploadDto,
  type InitiateMessageAttachmentUploadResponseDto,
  type MessageResponseDto,
  UpdateMessageDto,
} from "../dto/messages.dto";
import {
  DeleteMessageService,
  EditMessageService,
  FinalizeAttachmentMessageService,
  InitiateMessageAttachmentUploadService,
  SendMessageService,
} from "../application/messages.services";

@Controller()
export class MessagesController {
  constructor(
    private readonly initiateMessageAttachmentUploadService: InitiateMessageAttachmentUploadService,
    private readonly sendMessageService: SendMessageService,
    private readonly finalizeAttachmentMessageService: FinalizeAttachmentMessageService,
    private readonly editMessageService: EditMessageService,
    private readonly deleteMessageService: DeleteMessageService,
  ) {}

  @Post("messages/attachments/upload")
  async initiateAttachmentUpload(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: InitiateMessageAttachmentUploadDto,
  ): Promise<InitiateMessageAttachmentUploadResponseDto> {
    return this.initiateMessageAttachmentUploadService.execute({
      userId: user.id,
      payload: body,
    });
  }

  @Post("conversations/:conversationId/messages")
  async sendTextMessage(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() body: CreateConversationMessageDto,
  ): Promise<MessageResponseDto> {
    return this.sendMessageService.execute({
      userId: user.id,
      conversationId,
      payload: body,
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });
  }

  @Post("messages/attachments/finalize")
  async finalizeAttachment(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: FinalizeMessageAttachmentDto,
  ): Promise<MessageResponseDto> {
    return this.finalizeAttachmentMessageService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });
  }

  @Patch("messages/:messageId")
  async editMessage(
    @CurrentUser() user: AuthContext["user"],
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() body: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.editMessageService.execute({
      userId: user.id,
      messageId,
      payload: body,
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });
  }

  @Delete("messages/:messageId")
  @HttpCode(204)
  async deleteMessage(
    @CurrentUser() user: AuthContext["user"],
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
  ): Promise<void> {
    await this.deleteMessageService.execute({
      userId: user.id,
      messageId,
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });
  }
}

```

FILE: src/modules/messages/messages.module.ts
```ts
import { Module } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AuditLogService } from "../../common/services/audit-log.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { UsersModule } from "../users/users.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MessagesController } from "./controllers/messages.controller";
import {
  ConversationMessageSummaryService,
  DeleteMessageService,
  EditMessageService,
  EmitTypingIndicatorService,
  FinalizeAttachmentMessageService,
  InitiateMessageAttachmentUploadService,
  MessageDispatchService,
  MessageReaderService,
  SendMessageService,
} from "./application/messages.services";
import {
  AttachmentPolicyService,
  MessagePolicyService,
  MessageSequenceService,
} from "./domain/messages.domain";
import {
  MessageAttachmentUploadStateStore,
  MessageInteractionRepository,
  MessageRepository,
} from "./infrastructure/messages.infrastructure";
import { ConversationMessagePolicy } from "./policies/conversation-message.policy";
import { MessageSenderPolicy } from "./policies/message-sender.policy";

@Module({
  imports: [UsersModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [
    AppLogger,
    AuditLogService,
    DomainEventPublisher,
    MessageReaderService,
    MessageDispatchService,
    ConversationMessageSummaryService,
    InitiateMessageAttachmentUploadService,
    SendMessageService,
    FinalizeAttachmentMessageService,
    EditMessageService,
    DeleteMessageService,
    EmitTypingIndicatorService,
    MessagePolicyService,
    MessageSequenceService,
    AttachmentPolicyService,
    MessageRepository,
    MessageInteractionRepository,
    MessageAttachmentUploadStateStore,
    MessageSenderPolicy,
    ConversationMessagePolicy,
  ],
  exports: [MessageReaderService, MessageDispatchService, EmitTypingIndicatorService],
})
export class MessagesModule {}

```

FILE: src/modules/presence/dto/presence.dto.ts
```ts
import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validate,
} from "class-validator";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

export class WsHandshakeAuthDto {
  @IsString()
  @IsNotEmpty()
  readonly accessToken!: string;

  @IsUUID("4")
  readonly sessionId!: string;

  @IsOptional()
  @IsString()
  readonly lastEventId?: string | null;
}

export class PresenceHeartbeatDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsIn(["ONLINE"])
  readonly status!: "ONLINE";
}

export class ConversationTypingEventDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsUUID("4")
  readonly conversationId!: string;
}

export interface WsReadyDto {
  connectionId: string;
  userId: string;
  sessionId: string;
  serverTime: string;
}

export interface WsAckSuccessDto {
  ok: true;
  requestId: string;
  serverTime: string;
}

export interface WsAckErrorDto {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
}

export interface WsSystemErrorDto {
  code: string;
  message: string;
  requestId: string;
  details: Record<string, unknown>;
}

export interface PresenceUpdatedEventDto {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  updatedAt: string;
}

export interface ConversationTypingUpdatedEventDto {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  expiresAt: string;
}

export type WsAckPayload = WsAckSuccessDto | WsAckErrorDto;
export type WsAckCallback = (payload: WsAckPayload) => void;

export async function validateWsPayload<TPayload extends object>(
  cls: new () => TPayload,
  value: unknown,
): Promise<TPayload> {
  const instance = plainToInstance(cls, value);
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Invalid websocket payload",
      {
        validationErrors: errors.map((error) => ({
          property: error.property,
          constraints: error.constraints ?? {},
        })),
      },
    );
  }

  return instance;
}

```

FILE: src/modules/presence/events/presence.events.ts
```ts
export const PRESENCE_EVENTS = {
  UPDATED: "presence.updated",
} as const;

```

FILE: src/modules/presence/domain/presence.domain.ts
```ts
import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

@Injectable()
export class PresencePolicyService {
  assertHeartbeatStatus(status: string): asserts status is "ONLINE" {
    if (status !== "ONLINE") {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Presence heartbeat status is invalid",
      );
    }
  }
}

```

FILE: src/modules/presence/policies/ws-session.policy.ts
```ts
import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import type { AuthContext } from "../../../common/types/auth-context.type";

@Injectable()
export class WsSessionPolicy {
  assertHandshakeSession(authContext: AuthContext, sessionId: string): void {
    if (authContext.session.id !== sessionId) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Session is invalid",
      );
    }
  }
}

```

FILE: src/modules/presence/infrastructure/presence.repository.ts
```ts
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

const PRESENCE_TTL_SECONDS = 60;

export interface PresenceSnapshot {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  updatedAt: string;
}

@Injectable()
export class PresenceRepository {
  constructor(private readonly redis: RedisService) {}

  async markOnline(userId: string, updatedAt: string): Promise<void> {
    await this.redis
      .multi()
      .hset(this.userKey(userId), {
        status: "ONLINE",
        updatedAt,
      })
      .expire(this.userKey(userId), PRESENCE_TTL_SECONDS)
      .exec();
  }

  async markOffline(userId: string, updatedAt: string): Promise<void> {
    await this.redis
      .multi()
      .hset(this.userKey(userId), {
        status: "OFFLINE",
        updatedAt,
      })
      .expire(this.userKey(userId), PRESENCE_TTL_SECONDS)
      .exec();
  }

  async get(userId: string): Promise<PresenceSnapshot | null> {
    const result = await this.redis.hgetall(this.userKey(userId));
    if (!result.status || !result.updatedAt) {
      return null;
    }

    return {
      userId,
      status: result.status === "ONLINE" ? "ONLINE" : "OFFLINE",
      updatedAt: result.updatedAt,
    };
  }

  private userKey(userId: string): string {
    return `presence:user:${userId}`;
  }
}

```

FILE: src/modules/presence/infrastructure/socket-registry.repository.ts
```ts
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

const CONNECTION_TTL_SECONDS = 75;

export interface SocketConnectionRecord {
  connectionId: string;
  socketId: string;
  userId: string;
  sessionId: string;
  connectedAt: string;
  lastHeartbeatAt: string;
}

@Injectable()
export class SocketRegistryRepository {
  constructor(private readonly redis: RedisService) {}

  async register(input: SocketConnectionRecord): Promise<void> {
    await this.redis
      .multi()
      .set(
        this.connectionKey(input.connectionId),
        JSON.stringify(input),
        "EX",
        CONNECTION_TTL_SECONDS,
      )
      .sadd(this.userSetKey(input.userId), input.connectionId)
      .sadd(this.sessionSetKey(input.sessionId), input.connectionId)
      .exec();
  }

  async refreshHeartbeat(
    connectionId: string,
    heartbeatAt: string,
  ): Promise<SocketConnectionRecord | null> {
    const existing = await this.get(connectionId);
    if (!existing) {
      return null;
    }

    const updated: SocketConnectionRecord = {
      ...existing,
      lastHeartbeatAt: heartbeatAt,
    };
    await this.redis.set(
      this.connectionKey(connectionId),
      JSON.stringify(updated),
      "EX",
      CONNECTION_TTL_SECONDS,
    );

    return updated;
  }

  async get(connectionId: string): Promise<SocketConnectionRecord | null> {
    const raw = await this.redis.get(this.connectionKey(connectionId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SocketConnectionRecord;
  }

  async unregister(connectionId: string): Promise<SocketConnectionRecord | null> {
    const existing = await this.get(connectionId);
    if (!existing) {
      return null;
    }

    await this.redis
      .multi()
      .del(this.connectionKey(connectionId))
      .srem(this.userSetKey(existing.userId), connectionId)
      .srem(this.sessionSetKey(existing.sessionId), connectionId)
      .exec();

    return existing;
  }

  async countActiveConnectionsForUser(userId: string): Promise<number> {
    return this.cleanupAndCountSet(this.userSetKey(userId));
  }

  async countActiveConnectionsForSession(sessionId: string): Promise<number> {
    return this.cleanupAndCountSet(this.sessionSetKey(sessionId));
  }

  private async cleanupAndCountSet(key: string): Promise<number> {
    const connectionIds = await this.redis.smembers(key);
    if (connectionIds.length === 0) {
      return 0;
    }

    const pipeline = this.redis.pipeline();
    for (const connectionId of connectionIds) {
      pipeline.exists(this.connectionKey(connectionId));
    }
    const results = await pipeline.exec();
    if (!results) {
      return 0;
    }

    const staleIds: string[] = [];
    let activeCount = 0;
    for (const [index, result] of results.entries()) {
      const value = result[1];
      if (value === 1) {
        activeCount += 1;
      } else {
        staleIds.push(connectionIds[index]!);
      }
    }

    if (staleIds.length > 0) {
      await this.redis.srem(key, ...staleIds);
    }

    return activeCount;
  }

  private connectionKey(connectionId: string): string {
    return `ws:connection:${connectionId}`;
  }

  private userSetKey(userId: string): string {
    return `ws:user:${userId}:connections`;
  }

  private sessionSetKey(sessionId: string): string {
    return `ws:session:${sessionId}:connections`;
  }
}

```

FILE: src/modules/presence/infrastructure/typing-state.repository.ts
```ts
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

const TYPING_TTL_SECONDS = 6;

@Injectable()
export class TypingStateRepository {
  constructor(private readonly redis: RedisService) {}

  async startTyping(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
  }): Promise<void> {
    const entry = this.connectionConversationKey(
      input.conversationId,
      input.userId,
      input.connectionId,
    );

    await this.redis
      .multi()
      .set(entry, "1", "EX", TYPING_TTL_SECONDS)
      .sadd(this.conversationUserSetKey(input.conversationId, input.userId), input.connectionId)
      .sadd(this.connectionIndexKey(input.connectionId), `${input.conversationId}:${input.userId}`)
      .expire(this.connectionIndexKey(input.connectionId), TYPING_TTL_SECONDS)
      .exec();
  }

  async stopTyping(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
  }): Promise<void> {
    await this.redis
      .multi()
      .del(
        this.connectionConversationKey(
          input.conversationId,
          input.userId,
          input.connectionId,
        ),
      )
      .srem(this.conversationUserSetKey(input.conversationId, input.userId), input.connectionId)
      .srem(this.connectionIndexKey(input.connectionId), `${input.conversationId}:${input.userId}`)
      .exec();
  }

  async clearConnection(connectionId: string): Promise<Array<{
    conversationId: string;
    userId: string;
  }>> {
    const entries = await this.redis.smembers(this.connectionIndexKey(connectionId));
    if (entries.length === 0) {
      return [];
    }

    const pipeline = this.redis.multi();
    for (const entry of entries) {
      const [conversationId, userId] = entry.split(":");
      if (!conversationId || !userId) {
        continue;
      }
      pipeline.del(this.connectionConversationKey(conversationId, userId, connectionId));
      pipeline.srem(this.conversationUserSetKey(conversationId, userId), connectionId);
    }
    pipeline.del(this.connectionIndexKey(connectionId));
    await pipeline.exec();

    return entries.flatMap((entry) => {
      const [conversationId, userId] = entry.split(":");
      if (!conversationId || !userId) {
        return [];
      }

      return [{ conversationId, userId }];
    });
  }

  async countTypingConnections(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const setKey = this.conversationUserSetKey(conversationId, userId);
    const connectionIds = await this.redis.smembers(setKey);
    if (connectionIds.length === 0) {
      return 0;
    }

    const pipeline = this.redis.pipeline();
    for (const connectionId of connectionIds) {
      pipeline.exists(
        this.connectionConversationKey(conversationId, userId, connectionId),
      );
    }
    const results = await pipeline.exec();
    if (!results) {
      return 0;
    }

    const staleIds: string[] = [];
    let activeCount = 0;
    for (const [index, result] of results.entries()) {
      const exists = result[1];
      if (exists === 1) {
        activeCount += 1;
      } else {
        staleIds.push(connectionIds[index]!);
      }
    }

    if (staleIds.length > 0) {
      await this.redis.srem(setKey, ...staleIds);
    }

    return activeCount;
  }

  getExpiresAt(): string {
    return new Date(Date.now() + TYPING_TTL_SECONDS * 1000).toISOString();
  }

  private conversationUserSetKey(conversationId: string, userId: string): string {
    return `typing:conversation:${conversationId}:user:${userId}:connections`;
  }

  private connectionConversationKey(
    conversationId: string,
    userId: string,
    connectionId: string,
  ): string {
    return `typing:conversation:${conversationId}:user:${userId}:connection:${connectionId}`;
  }

  private connectionIndexKey(connectionId: string): string {
    return `typing:connection:${connectionId}:entries`;
  }
}

```

FILE: src/modules/presence/infrastructure/domain-event-subscriber.service.ts
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type IORedis from "ioredis";
import { AppLogger } from "../../../common/logger/app-logger.service";
import type { DomainEventEnvelope } from "../../../common/services/domain-event.publisher";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PresenceRealtimeFanoutService } from "../application/presence.services";

@Injectable()
export class PresenceDomainEventSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber: IORedis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly fanoutService: PresenceRealtimeFanoutService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    await this.subscriber.connect();
    await this.subscriber.subscribe("domain-events");
    this.subscriber.on("message", (channel, payload) => {
      if (channel !== "domain-events") {
        return;
      }

      try {
        const envelope = JSON.parse(payload) as DomainEventEnvelope;
        this.fanoutService.fanoutDomainEvent({
          name: envelope.name,
          payload:
            typeof envelope.payload === "object" && envelope.payload !== null
              ? (envelope.payload as Record<string, unknown>)
              : {},
        });
      } catch (error) {
        this.logger.warn(
          `Failed to process realtime domain event: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    await this.subscriber.unsubscribe("domain-events");
    await this.subscriber.quit();
    this.subscriber = null;
  }
}

```

FILE: src/modules/presence/application/presence.services.ts
```ts
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { AppException } from "../../../common/errors/app.exception";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UserSessionRepository } from "../../sessions/infrastructure/sessions.infrastructure";
import {
  type PresenceUpdatedEventDto,
  type WsReadyDto,
  type WsSystemErrorDto,
} from "../dto/presence.dto";
import { PresencePolicyService } from "../domain/presence.domain";
import { PRESENCE_EVENTS } from "../events/presence.events";
import {
  PresenceRepository,
  type PresenceSnapshot,
} from "../infrastructure/presence.repository";
import { SocketRegistryRepository } from "../infrastructure/socket-registry.repository";
import { TypingStateRepository } from "../infrastructure/typing-state.repository";

interface LocalSocketRecord {
  socket: Socket;
  userId: string;
  sessionId: string;
}

@Injectable()
export class SocketRegistryService implements OnModuleDestroy {
  private readonly socketsByConnectionId = new Map<string, LocalSocketRecord>();
  private readonly connectionIdsByUserId = new Map<string, Set<string>>();

  registerLocalSocket(
    connectionId: string,
    userId: string,
    sessionId: string,
    socket: Socket,
  ): void {
    this.socketsByConnectionId.set(connectionId, {
      socket,
      userId,
      sessionId,
    });

    const existing = this.connectionIdsByUserId.get(userId) ?? new Set<string>();
    existing.add(connectionId);
    this.connectionIdsByUserId.set(userId, existing);
  }

  unregisterLocalSocket(connectionId: string): void {
    const existing = this.socketsByConnectionId.get(connectionId);
    if (!existing) {
      return;
    }

    this.socketsByConnectionId.delete(connectionId);
    const byUser = this.connectionIdsByUserId.get(existing.userId);
    if (!byUser) {
      return;
    }

    byUser.delete(connectionId);
    if (byUser.size === 0) {
      this.connectionIdsByUserId.delete(existing.userId);
    }
  }

  emitToUsers(userIds: string[], eventName: string, payload: unknown): void {
    const uniqueUserIds = [...new Set(userIds)];
    for (const userId of uniqueUserIds) {
      const connectionIds = this.connectionIdsByUserId.get(userId);
      if (!connectionIds) {
        continue;
      }

      for (const connectionId of connectionIds) {
        const record = this.socketsByConnectionId.get(connectionId);
        record?.socket.emit(eventName, payload);
      }
    }
  }

  emitToConnection(
    connectionId: string,
    eventName: string,
    payload: unknown,
  ): void {
    this.socketsByConnectionId.get(connectionId)?.socket.emit(eventName, payload);
  }

  onModuleDestroy(): void {
    this.socketsByConnectionId.clear();
    this.connectionIdsByUserId.clear();
  }
}

@Injectable()
export class RegisterSocketService {
  constructor(
    private readonly socketRegistryRepository: SocketRegistryRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly sessionRepository: UserSessionRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    connectionId: string;
    socketId: string;
    authContext: AuthContext;
  }): Promise<WsReadyDto> {
    const now = new Date();
    const nowIso = now.toISOString();

    await this.socketRegistryRepository.register({
      connectionId: input.connectionId,
      socketId: input.socketId,
      userId: input.authContext.user.id,
      sessionId: input.authContext.session.id,
      connectedAt: nowIso,
      lastHeartbeatAt: nowIso,
    });
    await this.presenceRepository.markOnline(input.authContext.user.id, nowIso);
    await this.sessionRepository.touchLastSeen(input.authContext.session.id, now);

    const activeConnectionCount =
      await this.socketRegistryRepository.countActiveConnectionsForUser(
        input.authContext.user.id,
      );

    if (activeConnectionCount === 1) {
      await this.domainEventPublisher.publish(PRESENCE_EVENTS.UPDATED, {
        userId: input.authContext.user.id,
        status: "ONLINE",
        updatedAt: nowIso,
        recipientUserIds: [input.authContext.user.id],
      } satisfies PresenceUpdatedEventDto & { recipientUserIds: string[] });
    }

    return {
      connectionId: input.connectionId,
      userId: input.authContext.user.id,
      sessionId: input.authContext.session.id,
      serverTime: nowIso,
    };
  }
}

@Injectable()
export class HeartbeatPresenceService {
  constructor(
    private readonly presencePolicyService: PresencePolicyService,
    private readonly socketRegistryRepository: SocketRegistryRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly sessionRepository: UserSessionRepository,
  ) {}

  async execute(input: {
    connectionId: string;
    sessionId: string;
    status: "ONLINE";
  }): Promise<void> {
    this.presencePolicyService.assertHeartbeatStatus(input.status);

    const now = new Date();
    const connection =
      await this.socketRegistryRepository.refreshHeartbeat(
        input.connectionId,
        now.toISOString(),
      );
    if (!connection) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is no longer active",
      );
    }

    if (connection.sessionId !== input.sessionId) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is invalid",
      );
    }

    await this.presenceRepository.markOnline(connection.userId, now.toISOString());
    await this.sessionRepository.touchLastSeen(input.sessionId, now);
  }
}

@Injectable()
export class GetPresenceService {
  constructor(private readonly presenceRepository: PresenceRepository) {}

  async execute(userId: string): Promise<PresenceSnapshot | null> {
    return this.presenceRepository.get(userId);
  }
}

@Injectable()
export class ConversationTypingStateService {
  constructor(
    private readonly typingStateRepository: TypingStateRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async start(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
    recipientUserIds: string[];
  }): Promise<string> {
    await this.typingStateRepository.startTyping({
      conversationId: input.conversationId,
      userId: input.userId,
      connectionId: input.connectionId,
    });

    const expiresAt = this.typingStateRepository.getExpiresAt();
    await this.domainEventPublisher.publish("message.typing", {
      conversationId: input.conversationId,
      userId: input.userId,
      recipientUserIds: input.recipientUserIds,
      isTyping: true,
      expiresAt,
    });

    return expiresAt;
  }

  async stop(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
    recipientUserIds: string[];
  }): Promise<void> {
    await this.typingStateRepository.stopTyping({
      conversationId: input.conversationId,
      userId: input.userId,
      connectionId: input.connectionId,
    });

    const activeCount = await this.typingStateRepository.countTypingConnections(
      input.conversationId,
      input.userId,
    );
    if (activeCount === 0) {
      await this.domainEventPublisher.publish("message.typing", {
        conversationId: input.conversationId,
        userId: input.userId,
        recipientUserIds: input.recipientUserIds,
        isTyping: false,
        expiresAt: new Date().toISOString(),
      });
    }
  }

  async clearConnection(connectionId: string): Promise<void> {
    const entries = await this.typingStateRepository.clearConnection(connectionId);
    for (const entry of entries) {
      const activeCount = await this.typingStateRepository.countTypingConnections(
        entry.conversationId,
        entry.userId,
      );
      if (activeCount === 0) {
        await this.domainEventPublisher.publish("message.typing", {
          conversationId: entry.conversationId,
          userId: entry.userId,
          recipientUserIds: [],
          isTyping: false,
          expiresAt: new Date().toISOString(),
        });
      }
    }
  }
}

@Injectable()
export class UnregisterSocketService {
  constructor(
    private readonly socketRegistryRepository: SocketRegistryRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly conversationTypingStateService: ConversationTypingStateService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(connectionId: string): Promise<void> {
    const connection = await this.socketRegistryRepository.unregister(connectionId);
    await this.conversationTypingStateService.clearConnection(connectionId);

    if (!connection) {
      return;
    }

    const remainingConnections =
      await this.socketRegistryRepository.countActiveConnectionsForUser(
        connection.userId,
      );
    if (remainingConnections === 0) {
      const updatedAt = new Date().toISOString();
      await this.presenceRepository.markOffline(connection.userId, updatedAt);
      await this.domainEventPublisher.publish(PRESENCE_EVENTS.UPDATED, {
        userId: connection.userId,
        status: "OFFLINE",
        updatedAt,
        recipientUserIds: [connection.userId],
      } satisfies PresenceUpdatedEventDto & { recipientUserIds: string[] });
    }
  }
}

@Injectable()
export class PresenceRealtimeFanoutService {
  constructor(
    private readonly socketRegistryService: SocketRegistryService,
    private readonly logger: AppLogger,
  ) {}

  fanoutDomainEvent(event: { name: string; payload: Record<string, unknown> }): void {
    switch (event.name) {
      case PRESENCE_EVENTS.UPDATED: {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, "presence.updated", {
          userId: String(event.payload.userId),
          status: event.payload.status,
          updatedAt: event.payload.updatedAt,
        });
        return;
      }
      case "match.created": {
        const userIds = Array.isArray(event.payload.userIds)
          ? event.payload.userIds.map(String)
          : [];
        const matchByUserId =
          typeof event.payload.matchByUserId === "object" &&
          event.payload.matchByUserId !== null
            ? (event.payload.matchByUserId as Record<string, unknown>)
            : {};

        for (const userId of userIds) {
          const match = matchByUserId[userId];
          if (!match) {
            continue;
          }

          this.socketRegistryService.emitToUsers([userId], "match.created", {
            match,
          });
        }
        return;
      }
      case "conversation.message.created":
      case "conversation.message.updated": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        const messageByUserId =
          typeof event.payload.messageByUserId === "object" &&
          event.payload.messageByUserId !== null
            ? (event.payload.messageByUserId as Record<string, unknown>)
            : {};
        const conversationId = String(event.payload.conversationId);

        for (const userId of recipientUserIds) {
          const message = messageByUserId[userId];
          if (!message) {
            continue;
          }

          this.socketRegistryService.emitToUsers([userId], event.name, {
            conversationId,
            message,
          });
        }
        return;
      }
      case "conversation.message.deleted": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, {
          conversationId: String(event.payload.conversationId),
          messageId: String(event.payload.messageId),
          sequence: Number(event.payload.sequence),
          status: event.payload.status,
          deletedAt: event.payload.deletedAt,
        });
        return;
      }
      case "conversation.read.updated": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, {
          conversationId: String(event.payload.conversationId),
          readState: event.payload.readState,
        });
        return;
      }
      case "message.typing": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0) {
          return;
        }

        this.socketRegistryService.emitToUsers(
          recipientUserIds,
          "conversation.typing.updated",
          {
            conversationId: String(event.payload.conversationId),
            userId: String(event.payload.userId),
            isTyping: Boolean(event.payload.isTyping),
            expiresAt: String(event.payload.expiresAt),
          },
        );
        return;
      }
      case "notification.created": {
        const recipientUserIds = normalizeRecipientUserIds(event.payload);
        if (recipientUserIds.length === 0 || !event.payload.notification) {
          return;
        }

        this.socketRegistryService.emitToUsers(recipientUserIds, event.name, {
          notification: event.payload.notification,
        });
        return;
      }
      default: {
        this.logger.debug(`Ignoring unhandled realtime domain event ${event.name}`);
      }
    }
  }
}

function normalizeRecipientUserIds(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.recipientUserIds)) {
    return payload.recipientUserIds.map(String);
  }
  if (Array.isArray(payload.userIds)) {
    return payload.userIds.map(String);
  }
  if (typeof payload.recipientUserId === "string") {
    return [payload.recipientUserId];
  }
  if (typeof payload.userId === "string") {
    return [payload.userId];
  }

  return [];
}

export function buildWsSystemError(
  error: unknown,
  requestId?: string,
): WsSystemErrorDto {
  if (error instanceof AppException) {
    const response = error.getResponse();
    return {
      code: error.code,
      message:
        typeof response === "object" &&
        response !== null &&
        "message" in response
          ? String((response as { message?: string }).message ?? "Request failed")
          : "Request failed",
      requestId: requestId ?? randomUUID(),
      details: error.details ?? {},
    };
  }

  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: "Unexpected server error",
    requestId: requestId ?? randomUUID(),
    details: {},
  };
}

```

FILE: src/modules/presence/presence.gateway.ts
```ts
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AppException } from "../../common/errors/app.exception";
import { ERROR_CODES } from "../../common/constants/error-codes";
import type { AuthContext } from "../../common/types/auth-context.type";
import { AuthContextService } from "../auth/application/auth.services";
import { EmitTypingIndicatorService } from "../messages/application/messages.services";
import {
  ConversationTypingEventDto,
  PresenceHeartbeatDto,
  type WsAckCallback,
  type WsAckErrorDto,
  type WsAckSuccessDto,
  WsHandshakeAuthDto,
  validateWsPayload,
} from "./dto/presence.dto";
import {
  buildWsSystemError,
  ConversationTypingStateService,
  HeartbeatPresenceService,
  RegisterSocketService,
  SocketRegistryService,
  UnregisterSocketService,
} from "./application/presence.services";
import { WsSessionPolicy } from "./policies/ws-session.policy";

interface SocketAuthData {
  authContext: AuthContext;
  connectionId: string;
}

@WebSocketGateway({
  namespace: "/ws",
  cors: {
    origin: true,
    credentials: false,
  },
})
export class PresenceGateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  constructor(
    private readonly authContextService: AuthContextService,
    private readonly wsSessionPolicy: WsSessionPolicy,
    private readonly socketRegistryService: SocketRegistryService,
    private readonly registerSocketService: RegisterSocketService,
    private readonly unregisterSocketService: UnregisterSocketService,
    private readonly heartbeatPresenceService: HeartbeatPresenceService,
    private readonly emitTypingIndicatorService: EmitTypingIndicatorService,
    private readonly conversationTypingStateService: ConversationTypingStateService,
    private readonly logger: AppLogger,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const handshake = await validateWsPayload(
        WsHandshakeAuthDto,
        socket.handshake.auth ?? {},
      );
      const authContext = await this.authContextService.authenticateAccessToken(
        handshake.accessToken,
      );
      this.wsSessionPolicy.assertHandshakeSession(
        authContext,
        handshake.sessionId,
      );

      const connectionId = randomUUID();
      socket.data.auth = {
        authContext,
        connectionId,
      } satisfies SocketAuthData;
      this.socketRegistryService.registerLocalSocket(
        connectionId,
        authContext.user.id,
        authContext.session.id,
        socket,
      );

      const ready = await this.registerSocketService.execute({
        connectionId,
        socketId: socket.id,
        authContext,
      });
      socket.emit("system.ready", ready);
    } catch (error) {
      const systemError = buildWsSystemError(error);
      socket.emit("system.error", systemError);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const auth = this.readSocketAuth(socket);
    if (!auth) {
      return;
    }

    this.socketRegistryService.unregisterLocalSocket(auth.connectionId);
    try {
      await this.unregisterSocketService.execute(auth.connectionId);
    } catch (error) {
      this.logger.warn(
        `Failed to unregister socket ${auth.connectionId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  @SubscribeMessage("presence.heartbeat")
  async handleHeartbeat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(PresenceHeartbeatDto, body);

      await this.heartbeatPresenceService.execute({
        connectionId: auth.connectionId,
        sessionId: auth.authContext.session.id,
        status: dto.status,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("conversation.typing.start")
  async handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(ConversationTypingEventDto, body);
      const authorization = await this.emitTypingIndicatorService.execute({
        userId: auth.authContext.user.id,
        conversationId: dto.conversationId,
      });

      await this.conversationTypingStateService.start({
        conversationId: dto.conversationId,
        userId: auth.authContext.user.id,
        connectionId: auth.connectionId,
        recipientUserIds: authorization.recipientUserIds,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("conversation.typing.stop")
  async handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(ConversationTypingEventDto, body);
      const authorization = await this.emitTypingIndicatorService.execute({
        userId: auth.authContext.user.id,
        conversationId: dto.conversationId,
      });

      await this.conversationTypingStateService.stop({
        conversationId: dto.conversationId,
        userId: auth.authContext.user.id,
        connectionId: auth.connectionId,
        recipientUserIds: authorization.recipientUserIds,
      });

      return dto.requestId;
    });
  }

  private async withAck(
    socket: Socket,
    payload: unknown,
    ack: WsAckCallback | undefined,
    handler: (payload: unknown) => Promise<string>,
  ): Promise<void> {
    try {
      const requestId = await handler(payload);
      const response: WsAckSuccessDto = {
        ok: true,
        requestId,
        serverTime: new Date().toISOString(),
      };
      ack?.(response);
    } catch (error) {
      const requestId =
        typeof payload === "object" &&
        payload !== null &&
        "requestId" in payload &&
        typeof (payload as { requestId?: unknown }).requestId === "string"
          ? ((payload as { requestId: string }).requestId)
          : undefined;
      const systemError = buildWsSystemError(error, requestId);
      if (ack) {
        const response: WsAckErrorDto = {
          ok: false,
          requestId: systemError.requestId,
          error: systemError,
        };
        ack(response);
      } else {
        socket.emit("system.error", systemError);
      }
    }
  }

  private requireSocketAuth(socket: Socket): SocketAuthData {
    const auth = this.readSocketAuth(socket);
    if (!auth) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is invalid",
      );
    }

    return auth;
  }

  private readSocketAuth(socket: Socket): SocketAuthData | null {
    if (
      typeof socket.data !== "object" ||
      socket.data === null ||
      !("auth" in socket.data)
    ) {
      return null;
    }

    return socket.data.auth as SocketAuthData;
  }
}

```

FILE: src/modules/presence/presence.module.ts
```ts
import { Module, forwardRef } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";
import { SessionsModule } from "../sessions/sessions.module";
import {
  ConversationTypingStateService,
  GetPresenceService,
  HeartbeatPresenceService,
  PresenceRealtimeFanoutService,
  RegisterSocketService,
  SocketRegistryService,
  UnregisterSocketService,
} from "./application/presence.services";
import { PresencePolicyService } from "./domain/presence.domain";
import { PresenceGateway } from "./presence.gateway";
import { PresenceRepository } from "./infrastructure/presence.repository";
import { SocketRegistryRepository } from "./infrastructure/socket-registry.repository";
import { TypingStateRepository } from "./infrastructure/typing-state.repository";
import { PresenceDomainEventSubscriberService } from "./infrastructure/domain-event-subscriber.service";
import { WsSessionPolicy } from "./policies/ws-session.policy";

@Module({
  imports: [AuthModule, SessionsModule, forwardRef(() => MessagesModule)],
  providers: [
    AppLogger,
    DomainEventPublisher,
    PresenceGateway,
    SocketRegistryService,
    RegisterSocketService,
    UnregisterSocketService,
    HeartbeatPresenceService,
    GetPresenceService,
    ConversationTypingStateService,
    PresenceRealtimeFanoutService,
    PresencePolicyService,
    PresenceRepository,
    SocketRegistryRepository,
    TypingStateRepository,
    PresenceDomainEventSubscriberService,
    WsSessionPolicy,
  ],
  exports: [GetPresenceService, SocketRegistryService],
})
export class PresenceModule {}

```

FILE: src/modules/messages/domain/messages.domain.spec.ts
```ts
import { AppException } from "../../../common/errors/app.exception";
import {
  AttachmentPolicyService,
  MessagePolicyService,
} from "./messages.domain";

describe("MessagePolicyService", () => {
  let service: MessagePolicyService;

  beforeEach(() => {
    service = new MessagePolicyService();
  });

  it("rejects editing after the 15 minute window", () => {
    const createdAt = new Date(Date.now() - 16 * 60 * 1000);

    expect(() =>
      service.assertEditable(
        {
          id: "message-1",
          senderId: "user-1",
          conversationId: "conversation-1",
          type: "TEXT",
          status: "ACTIVE",
          createdAt,
          sequence: 4,
        },
        "user-1",
        new Date(),
      ),
    ).toThrow(AppException);
  });

  it("rejects blocked conversations for message creation", () => {
    expect(() =>
      service.assertConversationWritable(
        {
          id: "conversation-1",
          status: "ACTIVE",
          lastMessageSequence: 0,
          match: {
            status: "ACTIVE",
            userLowId: "user-1",
            userHighId: "user-2",
            userLow: {
              id: "user-1",
              status: "ACTIVE",
              deletedAt: null,
              isChatFrozen: false,
            },
            userHigh: {
              id: "user-2",
              status: "ACTIVE",
              deletedAt: null,
              isChatFrozen: false,
            },
          },
        },
        "user-1",
        true,
      ),
    ).toThrow(AppException);
  });
});

describe("AttachmentPolicyService", () => {
  let service: AttachmentPolicyService;

  beforeEach(() => {
    service = new AttachmentPolicyService();
  });

  it("rejects finalize payloads whose mime type does not match the declared type", () => {
    expect(() =>
      service.assertFinalizeAllowed({
        conversationId: "conversation-1",
        clientMessageId: "client-1",
        type: "IMAGE",
        uploadToken: "upload-1",
        objectKey: "conversation-1/user-1/file.mp4",
        bucket: "message-attachments",
        mimeType: "video/mp4",
        sizeBytes: 1024,
        width: 1080,
        height: 720,
        durationSeconds: 10,
        replyToMessageId: null,
      }),
    ).toThrow(AppException);
  });

  it("rejects oversized audio uploads", () => {
    expect(() =>
      service.assertUploadAllowed({
        conversationId: "conversation-1",
        fileName: "voice-note.wav",
        mimeType: "audio/wav",
        sizeBytes: 16 * 1024 * 1024,
        sha256: null,
      }),
    ).toThrow(AppException);
  });
});

```

FILE: src/modules/messages/application/messages.services.spec.ts
```ts
import { SendMessageService } from "./messages.services";
import { MessagePolicyService, MessageSequenceService } from "../domain/messages.domain";

describe("SendMessageService", () => {
  it("uses the database-assigned next conversation sequence and emits a created event", async () => {
    const now = new Date("2026-04-20T10:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);

    const userReaderService = {
      getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }),
    };
    const conversationRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: "conversation-1",
        status: "ACTIVE",
        lastMessageSequence: 6,
        match: {
          status: "ACTIVE",
          userLowId: "user-1",
          userHighId: "user-2",
          userLow: {
            id: "user-1",
            status: "ACTIVE",
            deletedAt: null,
            isChatFrozen: false,
          },
          userHigh: {
            id: "user-2",
            status: "ACTIVE",
            deletedAt: null,
            isChatFrozen: false,
          },
        },
      }),
      advanceForNewMessage: jest.fn().mockResolvedValue({
        id: "conversation-1",
        lastMessageSequence: 7,
      }),
    };
    const conversationReadRepository = {
      updateReadState: jest.fn().mockResolvedValue(undefined),
    };
    const messageRepository = {
      findByConversationAndClientMessageId: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      findByConversationAndId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "message-1",
        conversationId: "conversation-1",
        senderId: "user-1",
        sequence: 7,
        clientMessageId: "client-1",
        type: "TEXT",
        textBody: "hello",
        attachmentObjectKey: null,
        attachmentBucket: null,
        attachmentMimeType: null,
        attachmentSizeBytes: null,
        attachmentWidth: null,
        attachmentHeight: null,
        attachmentDurationSeconds: null,
        attachmentModerationStatus: null,
        status: "ACTIVE",
        replyToMessageId: null,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
      isUniqueConstraintError: jest.fn().mockReturnValue(false),
    };
    const messageInteractionRepository = {
      hasActiveBlockBetween: jest.fn().mockResolvedValue(false),
    };
    const messageReaderService = {
      mapMessage: jest.fn().mockReturnValue({
        id: "message-1",
        conversationId: "conversation-1",
        senderId: "user-1",
        sequence: 7,
        clientMessageId: "client-1",
        type: "TEXT",
        textBody: "hello",
        attachment: {
          objectKey: null,
          url: null,
          mimeType: null,
          sizeBytes: null,
          width: null,
          height: null,
          durationSeconds: null,
          moderationStatus: null,
        },
        status: "ACTIVE",
        replyToMessageId: null,
        editedAt: null,
        deletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    };
    const messageDispatchService = {
      emitCreated: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogService = {
      write: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
        callback({}),
      ),
    };

    const service = new SendMessageService(
      prisma as never,
      userReaderService as never,
      conversationRepository as never,
      conversationReadRepository as never,
      messageRepository as never,
      messageInteractionRepository as never,
      new MessagePolicyService(),
      new MessageSequenceService(),
      messageReaderService as never,
      messageDispatchService as never,
      auditLogService as never,
    );

    const response = await service.execute({
      userId: "user-1",
      conversationId: "conversation-1",
      payload: {
        clientMessageId: "client-1",
        textBody: "hello",
        replyToMessageId: null,
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(messageRepository.create).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sequence: 7,
      }),
    );
    expect(messageDispatchService.emitCreated).toHaveBeenCalledTimes(1);
    expect(response.message.sequence).toBe(7);

    jest.useRealTimers();
  });

  it("returns the existing message for duplicate clientMessageId retries", async () => {
    const existingMessage = {
      id: "message-1",
      conversationId: "conversation-1",
      senderId: "user-1",
      sequence: 3,
      clientMessageId: "client-1",
      type: "TEXT",
      textBody: "hello again",
      attachmentObjectKey: null,
      attachmentBucket: null,
      attachmentMimeType: null,
      attachmentSizeBytes: null,
      attachmentWidth: null,
      attachmentHeight: null,
      attachmentDurationSeconds: null,
      attachmentModerationStatus: null,
      status: "ACTIVE",
      replyToMessageId: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    };
    const messageReaderService = {
      mapMessage: jest.fn().mockReturnValue({ id: "message-1", sequence: 3 }),
    };

    const service = new SendMessageService(
      { $transaction: jest.fn() } as never,
      { getRequiredById: jest.fn().mockResolvedValue({ id: "user-1" }) } as never,
      {} as never,
      {} as never,
      {
        findByConversationAndClientMessageId: jest.fn().mockResolvedValue(existingMessage),
      } as never,
      {} as never,
      new MessagePolicyService(),
      new MessageSequenceService(),
      messageReaderService as never,
      { emitCreated: jest.fn() } as never,
      { write: jest.fn() } as never,
    );

    const response = await service.execute({
      userId: "user-1",
      conversationId: "conversation-1",
      payload: {
        clientMessageId: "client-1",
        textBody: "hello again",
        replyToMessageId: null,
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(messageReaderService.mapMessage).toHaveBeenCalledWith(
      existingMessage,
      "user-1",
    );
    expect(response.message.id).toBe("message-1");
  });
});

```

FILE: src/modules/presence/application/presence.services.spec.ts
```ts
import { AppException } from "../../../common/errors/app.exception";
import {
  HeartbeatPresenceService,
  PresenceRealtimeFanoutService,
} from "./presence.services";
import { PresencePolicyService } from "../domain/presence.domain";

describe("HeartbeatPresenceService", () => {
  it("refreshes connection presence and session lastSeen for valid heartbeats", async () => {
    const socketRegistryRepository = {
      refreshHeartbeat: jest.fn().mockResolvedValue({
        connectionId: "connection-1",
        socketId: "socket-1",
        userId: "user-1",
        sessionId: "session-1",
        connectedAt: "2026-04-20T10:00:00.000Z",
        lastHeartbeatAt: "2026-04-20T10:01:00.000Z",
      }),
    };
    const presenceRepository = {
      markOnline: jest.fn().mockResolvedValue(undefined),
    };
    const sessionRepository = {
      touchLastSeen: jest.fn().mockResolvedValue(undefined),
    };

    const service = new HeartbeatPresenceService(
      new PresencePolicyService(),
      socketRegistryRepository as never,
      presenceRepository as never,
      sessionRepository as never,
    );

    await service.execute({
      connectionId: "connection-1",
      sessionId: "session-1",
      status: "ONLINE",
    });

    expect(socketRegistryRepository.refreshHeartbeat).toHaveBeenCalledTimes(1);
    expect(presenceRepository.markOnline).toHaveBeenCalledTimes(1);
    expect(sessionRepository.touchLastSeen).toHaveBeenCalledWith(
      "session-1",
      expect.any(Date),
    );
  });

  it("rejects heartbeats from mismatched sessions", async () => {
    const service = new HeartbeatPresenceService(
      new PresencePolicyService(),
      {
        refreshHeartbeat: jest.fn().mockResolvedValue({
          connectionId: "connection-1",
          socketId: "socket-1",
          userId: "user-1",
          sessionId: "session-2",
          connectedAt: "2026-04-20T10:00:00.000Z",
          lastHeartbeatAt: "2026-04-20T10:01:00.000Z",
        }),
      } as never,
      { markOnline: jest.fn() } as never,
      { touchLastSeen: jest.fn() } as never,
    );

    await expect(
      service.execute({
        connectionId: "connection-1",
        sessionId: "session-1",
        status: "ONLINE",
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});

describe("PresenceRealtimeFanoutService", () => {
  it("fans out conversation.read.updated only to the intended recipients", () => {
    const socketRegistryService = {
      emitToUsers: jest.fn(),
    };
    const service = new PresenceRealtimeFanoutService(
      socketRegistryService as never,
      { debug: jest.fn() } as never,
    );

    service.fanoutDomainEvent({
      name: "conversation.read.updated",
      payload: {
        conversationId: "conversation-1",
        readState: {
          conversationId: "conversation-1",
          userId: "user-1",
          lastReadMessageId: "message-9",
          lastReadSequence: 9,
          lastReadAt: "2026-04-20T10:05:00.000Z",
        },
        recipientUserIds: ["user-2"],
      },
    });

    expect(socketRegistryService.emitToUsers).toHaveBeenCalledWith(
      ["user-2"],
      "conversation.read.updated",
      {
        conversationId: "conversation-1",
        readState: {
          conversationId: "conversation-1",
          userId: "user-1",
          lastReadMessageId: "message-9",
          lastReadSequence: 9,
          lastReadAt: "2026-04-20T10:05:00.000Z",
        },
      },
    );
  });
});

```

