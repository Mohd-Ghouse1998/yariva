import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { ReportTargetType } from "../../../generated/prisma/client";

@Injectable()
export class ReportPolicyService {
  assertCanReport(input: {
    reporterUserId: string;
    reportedUserId: string | null;
  }): void {
    if (input.reporterUserId === input.reportedUserId) {
      throw new AppException(
        400,
        ERROR_CODES.REPORT_INVALID_TARGET,
        "Users cannot report themselves",
      );
    }
  }
}

@Injectable()
export class ReportDeduplicationService {
  buildDedupeKey(input: {
    reporterUserId: string;
    reportedUserId: string | null;
    targetType: ReportTargetType;
    targetId: string;
    reasonCode: string;
  }): string {
    return [
      input.reporterUserId,
      input.reportedUserId,
      input.targetType,
      input.targetId,
      input.reasonCode,
    ].join(":");
  }
}

