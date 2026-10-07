import { Injectable } from "@nestjs/common";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

@Injectable()
export class PresencePolicyService {
  assertHeartbeatStatus(status: string): asserts status is "ONLINE" {
    if (status !== "ONLINE") {
      throw new AppException(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "Presence heartbeat status is invalid",
      );
    }
  }
}
