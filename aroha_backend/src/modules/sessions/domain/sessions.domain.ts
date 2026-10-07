import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { UserSessionRepository } from "../infrastructure/sessions.infrastructure";

@Injectable()
export class SessionRotationPolicyService {
  constructor(private readonly userSessionRepository: UserSessionRepository) {}

  async findReusableSession(
    userId: string,
    deviceId: string | null | undefined,
  ) {
    if (!deviceId) {
      return null;
    }

    return this.userSessionRepository.findLatestActiveByUserAndDevice(
      userId,
      deviceId,
    );
  }
}

@Injectable()
export class DeviceSessionPolicyService {
  normalizeDeviceId(deviceId?: string | null): string | null {
    const normalized = deviceId?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
  }
}

@Injectable()
export class SessionOwnershipPolicy {
  assertOwned(ownerUserId: string, resourceUserId: string): void {
    if (ownerUserId !== resourceUserId) {
      throw new AppException(
        403,
        ERROR_CODES.SESSION_NOT_OWNED,
        "Session belongs to another user",
      );
    }
  }
}
