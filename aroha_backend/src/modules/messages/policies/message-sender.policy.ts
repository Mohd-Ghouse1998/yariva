import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Message } from "../../../generated/prisma/client";

@Injectable()
export class MessageSenderPolicy {
  assertOwnedBySender(
    message: Pick<Message, "senderId"> | null,
    actorUserId: string,
  ): void {
    if (!message) {
      throw new AppException(
        404,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    if (message.senderId !== actorUserId) {
      throw new AppException(
        403,
        ERROR_CODES.MESSAGE_NOT_OWNED,
        "Message belongs to another sender",
      );
    }
  }
}
