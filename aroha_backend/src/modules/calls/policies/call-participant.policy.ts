import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

@Injectable()
export class CallParticipantPolicy {
  assertParticipant(
    userId: string,
    call:
      | {
          initiatorUserId: string;
          receiverUserId: string;
        }
      | null,
  ): asserts call is {
    initiatorUserId: string;
    receiverUserId: string;
  } {
    if (
      !call ||
      (call.initiatorUserId !== userId && call.receiverUserId !== userId)
    ) {
      throw new AppException(
        404,
        ERROR_CODES.CALL_NOT_FOUND,
        "Call session not found",
      );
    }
  }

  assertReceiver(userId: string, receiverUserId: string): void {
    if (userId !== receiverUserId) {
      throw new AppException(
        403,
        ERROR_CODES.CALL_PERMISSION_DENIED,
        "Only the receiver can perform this call action",
      );
    }
  }

  resolveOtherUserId(
    call: {
      initiatorUserId: string;
      receiverUserId: string;
    },
    userId: string,
  ): string {
    return call.initiatorUserId === userId
      ? call.receiverUserId
      : call.initiatorUserId;
  }
}
