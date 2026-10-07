import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type {
  CallEndReason,
  CallSession,
  CallSessionStatus,
  CallType,
  ConversationStatus,
  MatchCommunicationSetting,
  MatchStatus,
  User,
  UserCommunicationPreference,
} from "../../../generated/prisma/client";

export const OPEN_CALL_STATUSES = [
  "RINGING",
  "ACCEPTED",
  "CONNECTING",
  "CONNECTED",
] as const;

type OpenCallStatus = (typeof OPEN_CALL_STATUSES)[number];

interface CallParticipantState
  extends Pick<User, "id" | "status" | "deletedAt" | "isCallFrozen"> {
  communicationPreference: Pick<
    UserCommunicationPreference,
    "allowVoiceCalls" | "allowVideoCalls" | "allowPushCalls"
  > | null;
}

interface PermissionEvaluationInput {
  callType: CallType;
  matchStatus: MatchStatus;
  conversationStatus: ConversationStatus | null;
  initiatorUser: CallParticipantState;
  receiverUser: CallParticipantState;
  initiatorMatchSetting: Pick<
    MatchCommunicationSetting,
    "allowVoiceCalls" | "allowVideoCalls"
  > | null;
  receiverMatchSetting: Pick<
    MatchCommunicationSetting,
    "allowVoiceCalls" | "allowVideoCalls"
  > | null;
  hasActiveBlock: boolean;
}

@Injectable()
export class CallPermissionService {
  assertInitiationAllowed(
    input: PermissionEvaluationInput & {
      conflictingActiveCallId: string | null;
    },
  ): void {
    this.assertMatchAndConversationActive(
      input.matchStatus,
      input.conversationStatus,
      false,
    );
    this.assertParticipantsPermitted(input);

    if (input.conflictingActiveCallId) {
      throw new AppException(
        409,
        ERROR_CODES.CALL_CONFLICT_ACTIVE_EXISTS,
        "A conflicting active call already exists for this match",
      );
    }
  }

  assertContinuationAllowed(input: PermissionEvaluationInput): void {
    this.assertMatchAndConversationActive(
      input.matchStatus,
      input.conversationStatus,
      true,
    );
    this.assertParticipantsPermitted(input);
  }

  assertSignalingVersion(
    expectedVersion: number,
    receivedVersion: number,
  ): void {
    if (expectedVersion !== receivedVersion) {
      throw new AppException(
        409,
        ERROR_CODES.CALL_STALE_SIGNAL,
        "Call signaling version is stale",
      );
    }
  }

  assertCallNotTerminal(status: CallSessionStatus): void {
    if (!OPEN_CALL_STATUSES.includes(status as OpenCallStatus)) {
      throw new AppException(
        409,
        ERROR_CODES.CALL_NOT_ACTIVE,
        "Call is no longer active",
      );
    }
  }

  assertRinging(status: CallSessionStatus): void {
    if (status !== "RINGING") {
      throw new AppException(
        409,
        ERROR_CODES.CALL_NOT_RINGING,
        "Call is not in ringing state",
      );
    }
  }

  assertReceiverSession(
    acceptedBySessionId: string | null,
    sessionId: string,
  ): void {
    if (!acceptedBySessionId || acceptedBySessionId !== sessionId) {
      throw new AppException(
        409,
        ERROR_CODES.CALL_ALREADY_ACCEPTED,
        "Another device already accepted the call",
      );
    }
  }

  assertValidSignalDirection(
    input: Pick<CallSession, "status" | "initiatorUserId" | "receiverUserId"> & {
      acceptedBySessionId: string | null;
      userId: string;
      sessionId: string;
      signalType: "ring.ack" | "offer" | "answer" | "ice";
    },
  ): void {
    const isInitiator = input.userId === input.initiatorUserId;
    const isReceiver = input.userId === input.receiverUserId;

    if (!isInitiator && !isReceiver) {
      throw new AppException(
        404,
        ERROR_CODES.CALL_NOT_FOUND,
        "Call session not found",
      );
    }

    switch (input.signalType) {
      case "ring.ack":
        if (!isReceiver) {
          throw new AppException(
            409,
            ERROR_CODES.CALL_SIGNAL_INVALID,
            "Only the receiver can acknowledge ringing",
          );
        }
        return;
      case "offer":
        if (isReceiver && input.status === "RINGING") {
          throw new AppException(
            409,
            ERROR_CODES.CALL_SIGNAL_INVALID,
            "The receiver cannot send an offer before accepting",
          );
        }
        if (isReceiver) {
          this.assertReceiverSession(input.acceptedBySessionId, input.sessionId);
        }
        return;
      case "answer":
        if (!isReceiver) {
          throw new AppException(
            409,
            ERROR_CODES.CALL_SIGNAL_INVALID,
            "Only the receiver can send an answer",
          );
        }
        this.assertReceiverSession(input.acceptedBySessionId, input.sessionId);
        return;
      case "ice":
        if (isReceiver) {
          this.assertReceiverSession(input.acceptedBySessionId, input.sessionId);
        }
        return;
    }
  }

  private assertMatchAndConversationActive(
    matchStatus: MatchStatus,
    conversationStatus: ConversationStatus | null,
    isContinuation: boolean,
  ): void {
    if (matchStatus !== "ACTIVE" || conversationStatus !== "ACTIVE") {
      throw new AppException(
        409,
        isContinuation
          ? ERROR_CODES.CALL_NOT_ACTIVE
          : ERROR_CODES.CALL_PERMISSION_DENIED,
        isContinuation
          ? "Call is no longer active"
          : "Call is not allowed by current permissions",
      );
    }
  }

  private assertParticipantsPermitted(input: PermissionEvaluationInput): void {
    const users = [input.initiatorUser, input.receiverUser];
    const matchSettings = [
      input.initiatorMatchSetting,
      input.receiverMatchSetting,
    ];

    if (input.hasActiveBlock) {
      throw new AppException(
        403,
        ERROR_CODES.CALL_PERMISSION_DENIED,
        "Call is not allowed by current permissions",
      );
    }

    for (const user of users) {
      if (
        user.status !== "ACTIVE" ||
        user.deletedAt !== null ||
        user.isCallFrozen
      ) {
        throw new AppException(
          403,
          ERROR_CODES.CALL_PERMISSION_DENIED,
          "Call is not allowed by current permissions",
        );
      }
    }

    for (const [index, user] of users.entries()) {
      if (
        !isCallTypeEnabledByGlobalPreference(
          input.callType,
          user.communicationPreference,
        ) ||
        !isCallTypeEnabledByMatchSetting(input.callType, matchSettings[index] ?? null)
      ) {
        throw new AppException(
          403,
          ERROR_CODES.CALL_PERMISSION_DENIED,
          "Call is not allowed by current permissions",
        );
      }
    }
  }
}

@Injectable()
export class CallStateMachineService {
  isTerminal(status: CallSessionStatus): boolean {
    return !OPEN_CALL_STATUSES.includes(status as OpenCallStatus);
  }

  resolveEndTransition(input: {
    status: CallSessionStatus;
    actorIsInitiator: boolean;
  }): {
    nextStatus: CallSessionStatus;
    endReason: CallEndReason;
  } {
    if (input.status === "RINGING") {
      if (!input.actorIsInitiator) {
        throw new AppException(
          409,
          ERROR_CODES.CALL_NOT_ACTIVE,
          "Call is no longer active",
        );
      }

      return {
        nextStatus: "CANCELED",
        endReason: "CANCELED",
      };
    }

    if (input.status === "ACCEPTED" || input.status === "CONNECTING" || input.status === "CONNECTED") {
      return {
        nextStatus: "ENDED",
        endReason: "HANGUP",
      };
    }

    throw new AppException(
      409,
      ERROR_CODES.CALL_NOT_ACTIVE,
      "Call is no longer active",
    );
  }

  resolveCleanupTransition(status: CallSessionStatus): {
    nextStatus: "MISSED" | "TIMED_OUT";
    endReason: "MISSED" | "TIMEOUT";
  } | null {
    if (status === "RINGING") {
      return {
        nextStatus: "MISSED",
        endReason: "MISSED",
      };
    }

    if (status === "ACCEPTED" || status === "CONNECTING") {
      return {
        nextStatus: "TIMED_OUT",
        endReason: "TIMEOUT",
      };
    }

    return null;
  }
}

function isCallTypeEnabledByGlobalPreference(
  callType: CallType,
  preference: Pick<
    UserCommunicationPreference,
    "allowVoiceCalls" | "allowVideoCalls"
  > | null,
): boolean {
  if (!preference) {
    return true;
  }

  return callType === "VOICE"
    ? preference.allowVoiceCalls
    : preference.allowVideoCalls;
}

function isCallTypeEnabledByMatchSetting(
  callType: CallType,
  setting: Pick<MatchCommunicationSetting, "allowVoiceCalls" | "allowVideoCalls"> | null,
): boolean {
  if (!setting) {
    return true;
  }

  return callType === "VOICE"
    ? setting.allowVoiceCalls
    : setting.allowVideoCalls;
}
