import { MessageAttachmentModerationProcessor } from "./message-attachment-moderation.processor";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-01T00:01:00.000Z");

function buildPendingMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "user-low",
    sequence: 7,
    clientMessageId: "client-1",
    type: "IMAGE",
    textBody: null,
    attachmentObjectKey: "attachments/message-1.jpg",
    attachmentBucket: "message-attachments",
    attachmentMimeType: "image/jpeg",
    attachmentSizeBytes: 1024,
    attachmentWidth: 100,
    attachmentHeight: 100,
    attachmentDurationSeconds: null,
    attachmentModerationStatus: "PENDING",
    status: "PENDING_MODERATION",
    replyToMessageId: null,
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt,
    conversation: {
      id: "conversation-1",
      lastMessageSequence: 7,
      match: {
        userLowId: "user-low",
        userHighId: "user-high",
      },
    },
    ...overrides,
  };
}

describe("MessageAttachmentModerationProcessor", () => {
  it("approves pending attachments and emits a message update", async () => {
    const message = buildPendingMessage();
    const updated = {
      ...message,
      status: "ACTIVE",
      attachmentModerationStatus: "APPROVED",
      conversation: undefined,
    };
    const tx = {
      message: {
        findUnique: jest.fn().mockResolvedValue(message),
        update: jest.fn().mockResolvedValue(updated),
        findFirst: jest.fn().mockResolvedValue(updated),
      },
      conversation: {
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditLogService = { write: jest.fn() };
    const domainEventPublisher = { publishSafely: jest.fn() };
    const objectStorageService = {
      createPresignedGetObject: jest.fn().mockResolvedValue("https://storage/message-1.jpg"),
    };
    const processor = new MessageAttachmentModerationProcessor(
      prisma as any,
      auditLogService as any,
      domainEventPublisher as any,
      objectStorageService as any,
    );

    await processor.process({
      data: { messageId: "message-1", approved: true, provider: "stub" },
    } as any);

    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        status: "ACTIVE",
        attachmentModerationStatus: "APPROVED",
      },
    });
    expect(auditLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "message.attachment.moderation.approve",
        entityId: "message-1",
      }),
      tx,
    );
    expect(domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      "conversation.message.updated",
      expect.objectContaining({
        conversationId: "conversation-1",
        recipientUserIds: ["user-low", "user-high"],
      }),
    );
  });

  it("rejects pending attachments, hides the message, and emits a delete event", async () => {
    const message = buildPendingMessage();
    const removed = {
      ...message,
      status: "REMOVED_BY_MODERATION",
      attachmentModerationStatus: "REJECTED",
      deletedAt: new Date("2026-01-01T00:02:00.000Z"),
      conversation: undefined,
    };
    const previous = {
      ...message,
      id: "message-0",
      sequence: 6,
      status: "ACTIVE",
      attachmentModerationStatus: "APPROVED",
      conversation: undefined,
    };
    const tx = {
      message: {
        findUnique: jest.fn().mockResolvedValue(message),
        update: jest.fn().mockResolvedValue(removed),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(previous)
          .mockResolvedValueOnce(previous),
      },
      conversation: {
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditLogService = { write: jest.fn() };
    const domainEventPublisher = { publishSafely: jest.fn() };
    const processor = new MessageAttachmentModerationProcessor(
      prisma as any,
      auditLogService as any,
      domainEventPublisher as any,
      { createPresignedGetObject: jest.fn() } as any,
    );

    await processor.process({
      data: { messageId: "message-1", approved: false, reason: "unsafe" },
    } as any);

    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: expect.objectContaining({
        status: "REMOVED_BY_MODERATION",
        attachmentModerationStatus: "REJECTED",
      }),
    });
    expect(auditLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "message.attachment.moderation.reject",
        metadata: expect.objectContaining({ reason: "unsafe" }),
      }),
      tx,
    );
    expect(domainEventPublisher.publishSafely).toHaveBeenCalledWith(
      "conversation.message.deleted",
      expect.objectContaining({
        conversationId: "conversation-1",
        messageId: "message-1",
        status: "REMOVED_BY_MODERATION",
      }),
    );
  });
});
