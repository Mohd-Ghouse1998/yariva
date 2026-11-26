import {
  DeleteMessageService,
  EditMessageService,
  SendMessageService,
} from "./messages.services";
import { MessagePolicyService, MessageSequenceService } from "../domain/messages.domain";

describe("SendMessageService", () => {
  afterEach(() => jest.useRealTimers());
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
      hasActiveBlockAmong: jest.fn().mockResolvedValue(false),
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
      { touchLastActiveAt: jest.fn().mockResolvedValue(undefined) } as never,
      conversationRepository as never,
      conversationReadRepository as never,
      messageRepository as never,
      messageInteractionRepository as never,
      new MessagePolicyService(),
      new MessageSequenceService(),
      messageReaderService as never,
      messageDispatchService as never,
      auditLogService as never,
      { dispatch: jest.fn() } as never,
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
      { touchLastActiveAt: jest.fn() } as never,
      { findByIdForUser: jest.fn().mockResolvedValue({
        id: "conversation-1", status: "ACTIVE",
        match: { userLowId: "user-1", userHighId: "user-2", status: "ACTIVE",
          userLow: { id: "user-1", status: "ACTIVE", deletedAt: null, isChatFrozen: false },
          userHigh: { id: "user-2", status: "ACTIVE", deletedAt: null, isChatFrozen: false } },
      }) } as never,
      {} as never,
      {
        findByConversationAndClientMessageId: jest.fn().mockResolvedValue(existingMessage),
      } as never,
      { hasActiveBlockAmong: jest.fn().mockResolvedValue(false) } as never,
      new MessagePolicyService(),
      new MessageSequenceService(),
      messageReaderService as never,
      { emitCreated: jest.fn() } as never,
      { write: jest.fn() } as never,
      { dispatch: jest.fn() } as never,
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

describe("EditMessageService", () => {
  afterEach(() => jest.useRealTimers());
  it("emits an updated event after editing a text message", async () => {
    const now = new Date("2026-04-20T10:10:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    const currentRecord = {
      id: "message-1",
      senderId: "user-1",
      conversationId: "conversation-1",
      type: "TEXT",
      status: "ACTIVE",
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      sequence: 5,
      textBody: "hello",
      attachmentObjectKey: null,
      attachmentBucket: null,
      attachmentMimeType: null,
      attachmentSizeBytes: null,
      attachmentWidth: null,
      attachmentHeight: null,
      attachmentDurationSeconds: null,
      attachmentModerationStatus: null,
      clientMessageId: "client-1",
      replyToMessageId: null,
      editedAt: null,
      deletedAt: null,
      updatedAt: now,
      conversation: {
        id: "conversation-1",
        status: "ACTIVE",
        match: {
          userLowId: "user-1",
          userHighId: "user-2",
          status: "ACTIVE",
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
    };
    const messageRepository = {
      findAccessRecordById: jest
        .fn()
        .mockResolvedValueOnce(currentRecord)
        .mockResolvedValueOnce(currentRecord),
      updateText: jest.fn().mockResolvedValue({
        ...currentRecord,
        textBody: "updated",
        editedAt: now,
      }),
    };
    const messageDispatchService = {
      emitUpdated: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EditMessageService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      messageRepository as never,
      {
        hasActiveBlockAmong: jest.fn().mockResolvedValue(false),
      } as never,
      new MessagePolicyService(),
      {
        mapMessage: jest.fn().mockReturnValue({ id: "message-1", textBody: "updated" }),
      } as never,
      messageDispatchService as never,
      {
        recompute: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const result = await service.execute({
      userId: "user-1",
      messageId: "message-1",
      payload: {
        textBody: "updated",
      },
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(messageDispatchService.emitUpdated).toHaveBeenCalledTimes(1);
    expect(result.message.textBody).toBe("updated");

    jest.useRealTimers();
  });
});

describe("DeleteMessageService", () => {
  it("emits a deleted event after soft deleting a message", async () => {
    const deletedAt = new Date("2026-04-20T10:15:00.000Z");
    const accessRecord = {
      id: "message-1",
      senderId: "user-1",
      conversationId: "conversation-1",
      type: "TEXT",
      status: "ACTIVE",
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      sequence: 5,
      conversation: {
        match: {
          userLowId: "user-1",
          userHighId: "user-2",
        },
      },
    };
    const messageDispatchService = {
      emitDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DeleteMessageService(
      {
        $transaction: jest.fn(async (callback: (tx: Record<string, never>) => Promise<unknown>) =>
          callback({}),
        ),
      } as never,
      {
        findAccessRecordById: jest
          .fn()
          .mockResolvedValueOnce(accessRecord)
          .mockResolvedValueOnce(accessRecord),
        markDeleted: jest.fn().mockResolvedValue({
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 5,
          deletedAt,
        }),
      } as never,
      new MessagePolicyService(),
      {
        recompute: jest.fn().mockResolvedValue(undefined),
      } as never,
      messageDispatchService as never,
      {
        write: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await service.execute({
      userId: "user-1",
      messageId: "message-1",
      metadata: {
        ipAddress: null,
        userAgent: null,
      },
    });

    expect(messageDispatchService.emitDeleted).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        status: "DELETED_BY_SENDER",
      }),
    );
  });
});
