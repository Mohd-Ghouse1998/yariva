import type { CursorPageQuery } from "../../types/discovery";
import type {
  ConversationDetailDto,
  ConversationMessagePageQuery,
  ConversationPageDto,
  ConversationReadRequest,
  ConversationReadResponse,
  CreateMessageRequest,
  MessageDto,
  MessagePageDto,
} from "../../types/conversation";
import { http } from "../http";

export const conversationsApi = {
  list: (query: CursorPageQuery = {}) =>
    http.get<ConversationPageDto>("conversations", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  get: (conversationId: string) =>
    http
      .get<{ conversation: ConversationDetailDto }>(
        `conversations/${conversationId}`,
      )
      .then((response) => response.conversation),
  messages: (conversationId: string, query: ConversationMessagePageQuery = {}) =>
    http.get<MessagePageDto>(`conversations/${conversationId}/messages`, {
      cursor: query.cursor,
      limit: query.limit,
    }),
  send: (conversationId: string, body: CreateMessageRequest) =>
    http
      .post<{ message: MessageDto }>(
        `conversations/${conversationId}/messages`,
        {
          clientMessageId: body.clientMessageId,
          textBody: body.textBody,
          replyToMessageId: body.replyToMessageId,
        },
      )
      .then((response) => response.message),
  read: (conversationId: string, body: ConversationReadRequest) =>
    http
      .post<{ readState: ConversationReadResponse }>(
        `conversations/${conversationId}/read`,
        body,
      )
      .then((response) => response.readState),
};
