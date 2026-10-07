import type {
  FinalizeMessageAttachmentRequest,
  InitiateMessageAttachmentUploadRequest,
  InitiateMessageAttachmentUploadResponse,
  MessageDto,
  UpdateMessageRequest,
} from "../../types/conversation";
import { http } from "../http";

export type FinalizeMessageAttachmentInput = FinalizeMessageAttachmentRequest & {
  /** Used only by the local fixture router; never populated in real API mode. */
  fixturePreviewUri?: string;
};

export const messagesApi = {
  initiateAttachment: (body: InitiateMessageAttachmentUploadRequest) =>
    http.post<InitiateMessageAttachmentUploadResponse>("messages/attachments/upload", body),
  finalizeAttachment: (body: FinalizeMessageAttachmentInput) =>
    http
      .post<{ message: MessageDto }>("messages/attachments/finalize", body)
      .then((response) => response.message),
  update: (messageId: string, body: UpdateMessageRequest) =>
    http
      .patch<{ message: MessageDto }>(`messages/${messageId}`, body)
      .then((response) => response.message),
  delete: (messageId: string) => http.delete<void>(`messages/${messageId}`),
};
