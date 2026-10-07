import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { resolveVisibleAttachment } from "../../../common/utils/message-visibility.util";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { ConversationRepository } from "../../conversations/infrastructure/conversations.infrastructure";
import { MessageRepository } from "../infrastructure/messages.infrastructure";

@Injectable()
export class ReadMessageAttachmentService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationRepository,
    private readonly storage: ObjectStorageService,
  ) {}

  async execute(userId: string, messageId: string, range?: string) {
    const message = await this.messages.findById(messageId);
    if (!message || !await this.conversations.findByIdForUser(message.conversationId, userId)) {
      throw new AppException(404, ERROR_CODES.MESSAGE_NOT_FOUND, "Attachment is not available");
    }
    const visible = resolveVisibleAttachment(message, userId, () => "");
    if (!visible.objectKey || !message.attachmentBucket ||
        !(await this.storage.canDiscloseMedia({ viewerId: userId, ownerId: message.senderId }))) {
      throw new AppException(404, ERROR_CODES.MESSAGE_NOT_FOUND, "Attachment is not available");
    }
    if (range && !/^bytes=\d+-\d*$/.test(range)) {
      throw new AppException(416, ERROR_CODES.VALIDATION_FAILED, "Invalid media range");
    }
    return this.storage.readObjectStream({
      bucket: message.attachmentBucket,
      objectKey: visible.objectKey,
      range,
    });
  }
}
