import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";

@Injectable()
export class BlockPolicyService {
  assertCanBlock(blockerId: string, blockedId: string): void {
    if (blockerId === blockedId) {
      throw new AppException(
        400,
        ERROR_CODES.BLOCK_SELF_FORBIDDEN,
        "Users cannot block themselves",
      );
    }
  }
}

