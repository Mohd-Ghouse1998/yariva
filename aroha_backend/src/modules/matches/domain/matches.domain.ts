import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { Match, MatchCommunicationSetting } from "../../../generated/prisma/client";

@Injectable()
export class MatchParticipantPolicy {
  assertParticipant(
    userId: string,
    match:
      | Pick<Match, "userLowId" | "userHighId">
      | null,
  ): asserts match is Pick<Match, "userLowId" | "userHighId"> {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }
}

@Injectable()
export class MatchPolicyService {
  assertReadable<TMatch extends Pick<Match, "userLowId" | "userHighId">>(
    match: TMatch | null,
    userId: string,
  ): asserts match is TMatch {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }

  assertActive(match: Pick<Match, "status">): void {
    if (match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.MATCH_NOT_ACTIVE,
        "Match is no longer active",
      );
    }
  }
}

@Injectable()
export class MatchCommunicationPolicyService {
  assertManageable(match: Pick<Match, "status">): void {
    if (match.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.MATCH_NOT_ACTIVE,
        "Match is no longer active",
      );
    }
  }

  assertOwnedByUser(
    userId: string,
    setting:
      | Pick<MatchCommunicationSetting, "userId">
      | null,
  ): asserts setting is Pick<MatchCommunicationSetting, "userId"> {
    if (!setting || setting.userId !== userId) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }
}
