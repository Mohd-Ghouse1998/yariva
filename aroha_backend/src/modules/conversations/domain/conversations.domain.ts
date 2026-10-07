import { conversationParticipantIds, type ConversationContext } from "./conversation-context";
import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Conversation, Match } from "../../../generated/prisma/client";

@Injectable()
export class ConversationAccessPolicyService {
  assertParticipant(
    userId: string,
    context: Pick<Match, "userLowId" | "userHighId"> | ConversationContext | null,
  ): void {
    const ids = context && "match" in context ? conversationParticipantIds(context) :
      context ? [context.userLowId, context.userHighId] : [];
    if (!ids.includes(userId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }
  }

  assertReadable<TConversation extends Conversation>(
    conversation: TConversation | null,
  ): asserts conversation is TConversation {
    if (!conversation) {
      throw new AppException(
        404,
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        "Conversation not found",
      );
    }
  }

  assertCanUpdateReadState(
    conversation: Pick<Conversation, "status" | "lastMessageSequence">,
    match: Pick<Match, "status">,
    input: {
      currentLastReadSequence: number;
      requestedLastReadSequence: number;
    },
  ): void {
    if (conversation.status !== "ACTIVE" || match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.CONVERSATION_CLOSED,
        "Conversation no longer accepts activity",
      );
    }

    if (input.requestedLastReadSequence < input.currentLastReadSequence) {
      throw new AppException(
        400,
        ERROR_CODES.READ_SEQUENCE_INVALID,
        "Read sequence cannot regress",
      );
    }

    if (input.requestedLastReadSequence > conversation.lastMessageSequence) {
      throw new AppException(
        400,
        ERROR_CODES.READ_SEQUENCE_INVALID,
        "Read sequence exceeds conversation max",
      );
    }
  }
}

@Injectable()
export class UnreadCounterService {
  derive(lastMessageSequence: number, lastReadSequence: number): number {
    return Math.max(0, lastMessageSequence - lastReadSequence);
  }
}

@Injectable()
export class ConversationParticipantPolicy {
  assertParticipant(
    userId: string,
    participantIds: readonly string[],
  ): void {
    if (!participantIds.includes(userId)) {
      throw new AppException(
        403,
        ERROR_CODES.CONVERSATION_NOT_ACCESSIBLE,
        "Conversation is not accessible",
      );
    }
  }
}
