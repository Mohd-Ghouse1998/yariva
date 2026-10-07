import { describe, expect, it } from "vitest";
import type { MessageDto } from "../../types/conversation";
import {
  canSendMessage,
  getComposerAvailableWidth,
  getConversationRenderState,
  getSelectedAttachmentAsset,
  isConversationWritable,
  constrainMessageInput,
  MESSAGE_MAX_LENGTH,
  shouldSendFromKey,
  sortMessages,
  upsertMessage,
} from "./chatLogic";

const message = (overrides: Partial<MessageDto> = {}): MessageDto => ({
  id: "message-1",
  conversationId: "conversation-1",
  senderId: "user-1",
  sequence: 1,
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
  createdAt: "2026-08-09T10:00:00.000Z",
  updatedAt: "2026-08-09T10:00:00.000Z",
  ...overrides,
});

describe("chat composer logic", () => {
  it("rejects blank and whitespace-only messages", () => {
    expect(canSendMessage("", false)).toBe(false);
    expect(canSendMessage("   \n", false)).toBe(false);
  });

  it("allows a valid message once submission is idle", () => {
    expect(canSendMessage("Hello Meera", false)).toBe(true);
    expect(canSendMessage("Hello Meera", true)).toBe(false);
  });

  it("keeps the send button disabled while submission is in progress", () => {
    expect(canSendMessage("Send only once", true)).toBe(false);
  });

  it("enforces the 5,000 character limit for typing and paste", () => {
    const result = constrainMessageInput("x".repeat(MESSAGE_MAX_LENGTH + 100));
    expect(result).toHaveLength(MESSAGE_MAX_LENGTH);
    expect(canSendMessage(result, false)).toBe(true);
  });

  it("uses Enter to send on web and Shift+Enter for a newline", () => {
    expect(shouldSendFromKey({ platform: "web", key: "Enter", shiftKey: false })).toBe(true);
    expect(shouldSendFromKey({ platform: "web", key: "Enter", shiftKey: true })).toBe(false);
    expect(shouldSendFromKey({ platform: "ios", key: "Enter", shiftKey: false })).toBe(false);
  });
});

describe("chat presentation state", () => {
  it("uses a recoverable error state for an invalid conversation", () => {
    expect(
      getConversationRenderState({ loading: false, hasConversation: false, hasError: true }),
    ).toBe("error");
  });

  it("disables the composer for every closed conversation state", () => {
    expect(isConversationWritable("ACTIVE")).toBe(true);
    expect(isConversationWritable("BLOCKED")).toBe(false);
    expect(isConversationWritable("CLOSED_UNMATCHED")).toBe(false);
    expect(isConversationWritable("CLOSED_MODERATION")).toBe(false);
  });

  it("treats attachment-picker cancellation as a safe no-op", () => {
    expect(getSelectedAttachmentAsset({ canceled: true, assets: null })).toBeNull();
    expect(getSelectedAttachmentAsset({ canceled: false, assets: [] })).toBeNull();
  });

  it.each([320, 360, 390, 430])(
    "leaves a non-overlapping composer input area at %ipx",
    (viewportWidth) => {
      expect(getComposerAvailableWidth(viewportWidth)).toBeGreaterThanOrEqual(192);
    },
  );
});

describe("message reconciliation", () => {
  it("replaces an optimistic message by clientMessageId without duplicating it", () => {
    const optimistic = message({ id: "client-1", status: "PENDING_MODERATION" });
    const confirmed = message({ id: "server-1", status: "ACTIVE", sequence: 2 });
    const result = upsertMessage([optimistic], confirmed);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(confirmed);
  });

  it("appends a genuinely new incoming message", () => {
    const incoming = message({ id: "message-2", clientMessageId: null, sequence: 2 });
    expect(upsertMessage([message()], incoming)).toHaveLength(2);
  });

  it("keeps chronological sequence order", () => {
    const result = sortMessages([
      message({ id: "message-3", clientMessageId: "client-3", sequence: 3 }),
      message({ id: "message-1", sequence: 1 }),
      message({ id: "message-2", clientMessageId: "client-2", sequence: 2 }),
    ]);
    expect(result.map((item) => item.sequence)).toEqual([1, 2, 3]);
  });
});
