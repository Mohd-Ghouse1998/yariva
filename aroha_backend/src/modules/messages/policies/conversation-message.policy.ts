import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Match } from "../../../generated/prisma/client";

@Injectable()
export class ConversationMessagePolicy {
  assertParticipant(
    userId: string,
    match: Pick<Match, "userLowId" | "userHighId"> | null,
  ): void {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }
  }
}
