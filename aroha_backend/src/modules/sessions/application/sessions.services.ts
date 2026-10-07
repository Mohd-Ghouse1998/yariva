import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PushToken, UserSession } from "../../../generated/prisma/client";
import type { SessionDto } from "../../auth/dto/auth.dto";
import type {
  PushTokenDto,
  PushTokenResponseDto,
  RevokeOtherSessionsResponseDto,
  SessionPageDto,
} from "../dto/sessions.dto";
import { SessionOwnershipPolicy } from "../domain/sessions.domain";
import {
  PushTokenRepository,
  UserSessionRepository,
} from "../infrastructure/sessions.infrastructure";

export interface SessionActionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class ListSessionsService {
  constructor(private readonly userSessionRepository: UserSessionRepository) {}

  async execute(input: {
    userId: string;
    currentSessionId: string;
    cursor?: string;
    limit?: number;
  }): Promise<SessionPageDto> {
    const page = await this.userSessionRepository.listByUser(input.userId, {
      cursor: input.cursor,
      limit: input.limit ?? 20,
    });

    return {
      items: page.items.map((session) =>
        mapSessionDto(session, session.id === input.currentSessionId),
      ),
      nextCursor: page.nextCursor,
    };
  }
}

@Injectable()
export class RevokeSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly sessionOwnershipPolicy: SessionOwnershipPolicy,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    targetSessionId: string;
    metadata: SessionActionMetadata;
  }): Promise<void> {
    const session = await this.userSessionRepository.findById(input.targetSessionId);

    if (!session || session.deletedAt) {
      throw new AppException(404, ERROR_CODES.SESSION_NOT_FOUND, "Session not found");
    }

    this.sessionOwnershipPolicy.assertOwned(input.actor.user.id, session.userId);

    await this.prisma.$transaction(async (tx) => {
      await this.userSessionRepository.revokeById(tx, {
        sessionId: session.id,
        reason: "user_revoked_session",
        now: new Date(),
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "session.revoke",
          entityType: "UserSession",
          entityId: session.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });
  }
}

@Injectable()
export class RevokeAllOtherSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    metadata: SessionActionMetadata;
  }): Promise<RevokeOtherSessionsResponseDto> {
    const now = new Date();
    const revokedCount = await this.prisma.$transaction(async (tx) => {
      const count = await this.userSessionRepository.revokeAllOtherSessions(tx, {
        userId: input.actor.user.id,
        currentSessionId: input.actor.session.id,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "session.revoke-others",
          entityType: "User",
          entityId: input.actor.user.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
          metadata: {
            revokedCount: count,
          },
        },
        tx,
      );

      return count;
    });

    return { revokedCount };
  }
}

@Injectable()
export class RegisterPushTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    payload: PushTokenDto;
    metadata: SessionActionMetadata;
  }): Promise<PushTokenResponseDto> {
    const now = new Date();

    const pushToken = await this.prisma.$transaction(async (tx) => {
      const value = await this.pushTokenRepository.upsert(tx, {
        userId: input.actor.user.id,
        sessionId: input.actor.session.id,
        token: input.payload.token,
        platform: input.payload.platform,
        provider: input.payload.provider,
        deviceId: input.payload.deviceId ?? null,
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "push-token.register",
          entityType: "PushToken",
          entityId: value.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );

      return value;
    });

    return mapPushToken(pushToken);
  }
}

@Injectable()
export class InvalidatePushTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(input: {
    actor: AuthContext;
    pushTokenId: string;
    metadata: SessionActionMetadata;
  }): Promise<void> {
    const pushToken = await this.pushTokenRepository.findById(input.pushTokenId);

    if (!pushToken || pushToken.deletedAt) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Push token not found");
    }

    if (pushToken.userId !== input.actor.user.id) {
      throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Push token not found");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.pushTokenRepository.invalidateById(tx, pushToken.id, now);

      await this.auditLogService.write(
        {
          actorUserId: input.actor.user.id,
          actorSessionId: input.actor.session.id,
          action: "push-token.invalidate",
          entityType: "PushToken",
          entityId: pushToken.id,
          targetUserId: input.actor.user.id,
          ipAddress: input.metadata.ipAddress,
          userAgent: input.metadata.userAgent,
        },
        tx,
      );
    });
  }
}

function mapSessionDto(session: UserSession, isCurrent: boolean): SessionDto {
  return {
    id: session.id,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    platform: session.platform,
    appVersion: session.appVersion,
    lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    isCurrent,
  };
}

function mapPushToken(pushToken: PushToken): PushTokenResponseDto {
  return {
    id: pushToken.id,
    token: pushToken.token,
    platform: pushToken.platform,
    provider: pushToken.provider,
    deviceId: pushToken.deviceId,
    createdAt: pushToken.createdAt.toISOString(),
    updatedAt: pushToken.updatedAt.toISOString(),
  };
}
