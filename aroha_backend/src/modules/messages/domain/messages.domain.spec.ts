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
