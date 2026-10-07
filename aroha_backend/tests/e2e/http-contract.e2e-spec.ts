import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppLogger } from "../../src/common/logger/app-logger.service";
import { configureHttpServer } from "../../src/bootstrap/http.bootstrap";
import { PushTokensController } from "../../src/modules/sessions/controllers/push-tokens.controller";
import {
  InvalidatePushTokenService,
  RegisterPushTokenService,
} from "../../src/modules/sessions/application/sessions.services";
import { ProfilePhotosController } from "../../src/modules/profiles/controllers/profile-photos.controller";
import {
  DeleteProfilePhotoService,
  FinalizePhotoUploadService,
  InitiatePhotoUploadService,
  ReorderProfilePhotosService,
  SetPrimaryPhotoService,
} from "../../src/modules/profiles/application/profile-photos.services";
import { LikesController } from "../../src/modules/likes/controllers/likes.controller";
import {
  CreateLikeService,
  CreatePassService,
  GetLikesReceivedService,
  RetractLikeService,
  RetractPassService,
} from "../../src/modules/likes/application/likes.services";
import { ConversationsController } from "../../src/modules/conversations/controllers/conversations.controller";
import {
  GetConversationService,
  ListConversationMessagesService,
  ListConversationsService,
  MarkConversationReadService,
} from "../../src/modules/conversations/application/conversations.services";
import { MessagesController } from "../../src/modules/messages/controllers/messages.controller";
import {
  DeleteMessageService,
  EditMessageService,
  FinalizeAttachmentMessageService,
  InitiateMessageAttachmentUploadService,
  SendMessageService,
} from "../../src/modules/messages/application/messages.services";
import { ProfilesController } from "../../src/modules/profiles/controllers/profiles.controller";
import {
  GetMyProfileService,
  UpdateCommunicationPreferenceService,
  UpdateDiscoveryPreferenceService,
  UpdateLifestyleService,
  UpdateProfileService,
  UpdateSchedulePreferenceService,
} from "../../src/modules/profiles/application/profiles.services";
import { CallsController } from "../../src/modules/calls/controllers/calls.controller";
import {
  AcceptCallService,
  DeclineCallService,
  EndCallService,
  InitiateCallService,
} from "../../src/modules/calls/application/calls.services";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    PushTokensController,
    ProfilePhotosController,
    LikesController,
    ConversationsController,
    MessagesController,
    ProfilesController,
    CallsController,
  ],
  providers: [
    AppLogger,
    {
      provide: RegisterPushTokenService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ id: "push-token-1" }),
      },
    },
    {
      provide: InvalidatePushTokenService,
      useValue: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: InitiatePhotoUploadService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ uploadToken: "upload-token" }),
      },
    },
    {
      provide: FinalizePhotoUploadService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ photo: { id: "photo-1" } }),
      },
    },
    {
      provide: ReorderProfilePhotosService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ photos: [] }),
      },
    },
    {
      provide: SetPrimaryPhotoService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ photo: { id: "photo-1" } }),
      },
    },
    {
      provide: DeleteProfilePhotoService,
      useValue: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: CreateLikeService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ outcome: "LIKE_RECORDED" }),
      },
    },
    {
      provide: RetractLikeService,
      useValue: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: CreatePassService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ id: "pass-1" }),
      },
    },
    {
      provide: RetractPassService,
      useValue: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: GetLikesReceivedService,
      useValue: {
        execute: jest.fn().mockResolvedValue({
          items: [],
          nextCursor: null,
        }),
      },
    },
    {
      provide: ListConversationsService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      },
    },
    {
      provide: GetConversationService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ conversation: { id: "conversation-1" } }),
      },
    },
    {
      provide: ListConversationMessagesService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      },
    },
    {
      provide: MarkConversationReadService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ readState: { lastReadSequence: 1 } }),
      },
    },
    {
      provide: InitiateMessageAttachmentUploadService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ uploadToken: "message-upload-token" }),
      },
    },
    {
      provide: SendMessageService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ message: { id: "message-1" } }),
      },
    },
    {
      provide: FinalizeAttachmentMessageService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ message: { id: "message-2" } }),
      },
    },
    {
      provide: EditMessageService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ message: { id: "message-1" } }),
      },
    },
    {
      provide: DeleteMessageService,
      useValue: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    },
    {
      provide: GetMyProfileService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ profile: { userId: "user-1" } }),
      },
    },
    {
      provide: UpdateProfileService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ profile: { userId: "user-1" } }),
      },
    },
    {
      provide: UpdateLifestyleService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ value: {} }),
      },
    },
    {
      provide: UpdateSchedulePreferenceService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ value: {} }),
      },
    },
    {
      provide: UpdateDiscoveryPreferenceService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ value: {} }),
      },
    },
    {
      provide: UpdateCommunicationPreferenceService,
      useValue: {
        execute: jest.fn().mockResolvedValue({ value: {} }),
      },
    },
    {
      provide: InitiateCallService,
      useValue: {
        execute: jest.fn().mockResolvedValue({
          call: { id: "call-1", status: "RINGING" },
          iceServers: [{ urls: ["stun:example.org:3478"] }],
        }),
      },
    },
    {
      provide: AcceptCallService,
      useValue: {
        execute: jest.fn().mockResolvedValue({
          call: { id: "call-1", status: "ACCEPTED" },
          iceServers: [{ urls: ["stun:example.org:3478"] }],
        }),
      },
    },
    {
      provide: DeclineCallService,
      useValue: {
        execute: jest.fn().mockResolvedValue({
          call: { id: "call-1", status: "DECLINED" },
        }),
      },
    },
    {
      provide: EndCallService,
      useValue: {
        execute: jest.fn().mockResolvedValue({
          call: { id: "call-1", status: "ENDED" },
        }),
      },
    },
  ],
})
class HttpContractTestModule {}

describe("HTTP contract fixes (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HttpContractTestModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use((req: any, _res: any, next: () => void) => {
      req.auth = {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
        },
        session: {
          id: "22222222-2222-4222-8222-222222222222",
        },
      };
      next();
    });
    await configureHttpServer(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns the corrected success status codes", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/push-tokens")
      .send({
        token: "push-token",
        platform: "IOS",
        provider: "APNS",
        deviceId: null,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/profiles/photos/upload")
      .send({
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        sha256: null,
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete("/api/v1/profiles/photos/33333333-3333-4333-8333-333333333333")
      .expect(204);

    await request(app.getHttpServer())
      .post("/api/v1/likes")
      .send({
        targetUserId: "44444444-4444-4444-8444-444444444444",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/passes")
      .send({
        targetUserId: "55555555-5555-4555-8555-555555555555",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/conversations/66666666-6666-4666-8666-666666666666/read")
      .send({
        lastReadSequence: 4,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/messages/attachments/upload")
      .send({
        conversationId: "77777777-7777-4777-8777-777777777777",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        fileName: "photo.jpg",
        sha256: null,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/calls")
      .send({
        matchId: "88888888-8888-4888-8888-888888888888",
        callType: "VOICE",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/calls/99999999-9999-4999-8999-999999999999/accept")
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/calls/99999999-9999-4999-8999-999999999999/decline")
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/calls/99999999-9999-4999-8999-999999999999/end")
      .send({
        reason: "HANGUP",
      })
      .expect(200);
  });

  it("rejects invalid profile bio and invalid dateOfBirth strings through DTO validation", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/profiles/me")
      .send({
        bio: "short",
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch("/api/v1/profiles/me")
      .send({
        bio: "This is a sufficiently long bio for validation coverage.",
        dateOfBirth: "not-a-date",
      })
      .expect(400);
  });
});
