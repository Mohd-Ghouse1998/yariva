import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { ObjectStorageService } from "../../integrations/object-storage/object-storage.service";
import { lockConversationForMutation } from "../../modules/conversations/infrastructure/conversations.infrastructure";

@Injectable()
export class MessageAttachmentCleanupProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async process(upload: { conversationId: string; bucket: string; objectKey: string; expiresAt: string }, now = Date.now()) {
    if (!(Date.parse(upload.expiresAt) <= now)) return;
    const referenced = await this.prisma.$transaction(async (tx) => {
      await lockConversationForMutation(tx, upload.conversationId);
      return tx.message.findFirst({
        where: {
          conversationId: upload.conversationId,
          attachmentBucket: upload.bucket,
          attachmentObjectKey: upload.objectKey,
        },
        select: { id: true },
      });
    });
    if (!referenced) await this.storage.deleteObject({ bucket: upload.bucket, objectKey: upload.objectKey });
  }
}
