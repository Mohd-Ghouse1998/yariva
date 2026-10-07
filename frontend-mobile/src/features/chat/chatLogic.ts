import type { MessageDto } from "../../types/conversation";
import type { ConversationStatus } from "../../types/enums";

export const MESSAGE_MAX_LENGTH = 5_000;
export const MESSAGE_COUNTER_THRESHOLD = 4_500;
export const CHAT_TOUCH_TARGET = 44;
export const CHAT_COMPOSER_GAP = 8;
export const CHAT_COMPOSER_HORIZONTAL_PADDING = 12;

export const constrainMessageInput = (value: string): string =>
  value.slice(0, MESSAGE_MAX_LENGTH);

export const canSendMessage = (value: string, sending: boolean): boolean =>
  !sending && value.trim().length > 0 && value.length <= MESSAGE_MAX_LENGTH;

export const shouldSendFromKey = (input: {
  platform: string;
  key: string;
  shiftKey: boolean;
}): boolean => input.platform === "web" && input.key === "Enter" && !input.shiftKey;

export const getConversationRenderState = (input: {
  loading: boolean;
  hasConversation: boolean;
  hasError: boolean;
}): "loading" | "error" | "ready" => {
  if (input.loading) return "loading";
  if (input.hasError || !input.hasConversation) return "error";
  return "ready";
};

export const isConversationWritable = (status: ConversationStatus): boolean =>
  status === "ACTIVE";

export const getSelectedAttachmentAsset = <Asset>(result: {
  canceled: boolean;
  assets?: Asset[] | null;
}): Asset | null => (result.canceled ? null : (result.assets?.[0] ?? null));

export const getComposerAvailableWidth = (viewportWidth: number): number =>
  Math.max(
    0,
    viewportWidth -
      CHAT_COMPOSER_HORIZONTAL_PADDING * 2 -
      CHAT_TOUCH_TARGET * 2 -
      CHAT_COMPOSER_GAP * 2,
  );

export const isSameMessage = (left: MessageDto, right: MessageDto): boolean =>
  left.id === right.id ||
  Boolean(
    left.clientMessageId &&
      right.clientMessageId &&
      left.clientMessageId === right.clientMessageId,
  );

export const upsertMessage = (messages: MessageDto[], incoming: MessageDto): MessageDto[] => {
  const existingIndex = messages.findIndex((message) => isSameMessage(message, incoming));
  if (existingIndex < 0) return [...messages, incoming];
  return messages.map((message, index) => (index === existingIndex ? incoming : message));
};

export const sortMessages = (messages: MessageDto[]): MessageDto[] =>
  [...messages].sort((left, right) => {
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return left.createdAt.localeCompare(right.createdAt);
  });
