import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import authConfig from "../../../config/auth.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { hashWithPepper, randomBase64Url, safeEqualHex } from "../../../common/utils/crypto.util";
import type {
  Prisma,
  ProfilePhoto,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserProfile,
  UserSession,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { JwtAccessPayload } from "../../../common/types/auth-context.type";

export interface LoginAccountRecord extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
  intents: Pick<UserIntent, "id">[];
  photos: Pick<ProfilePhoto, "id" | "isPrimary">[];
}

export interface SessionAuthContextRecord extends UserSession {
  user: User;
}

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    return hash(password, 12);
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}

@Injectable()
export class OpaqueRefreshTokenService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  issue(sessionId: string): {
    token: string;
    tokenHash: string;
    jti: string;
  } {
    const jti = randomUUID();
    const secret = randomBase64Url(48);
    const token = `${sessionId}.${jti}.${secret}`;

    return {
      token,
      tokenHash: hashWithPepper(token, this.config.refreshTokenPepper),
      jti,
    };
  }

  parseOrThrow(token: string): {
    sessionId: string;
    jti: string;
  } {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    const [sessionId, jti, secret] = parts;
    if (!sessionId || !jti || !secret) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    return { sessionId, jti };
  }

  hash(token: string): string {
    return hashWithPepper(token, this.config.refreshTokenPepper);
  }

  matches(token: string, storedHash: string | null): boolean {
    if (!storedHash) {
      return false;
    }

    return safeEqualHex(this.hash(token), storedHash);
  }
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async issueAccessToken(user: User, sessionId: string): Promise<{
    token: string;
    expiresAt: Date;
    jti: string;
  }> {
    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.config.accessTokenTtlSeconds * 1000,
    );
    const payload: JwtAccessPayload = {
      sub: user.id,
      sid: sessionId,
      role: user.role,
      status: user.status,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: this.config.accessTokenTtlSeconds,
    });

    return { token, expiresAt, jti };
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtAccessPayload>(token);
    } catch {
      throw new AppException(
        401,
        ERROR_CODES.UNAUTHORIZED,
        "Invalid access token",
      );
    }
  }
}

@Injectable()
export class AuthUserReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByNormalizedIdentifier(identifier: {
    type: "email" | "phone";
    value: string;
  }): Promise<LoginAccountRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        ...(identifier.type === "email"
          ? { email: identifier.value }
          : { phone: identifier.value }),
      },
      include: {
        profile: true,
        discoveryPreference: true,
        communicationPreference: true,
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
          },
        },
        photos: {
          where: {
            deletedAt: null,
            purpose: "PROFILE",
            moderationStatus: "APPROVED",
          },
          select: {
            id: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  async findSessionContextById(
    sessionId: string,
  ): Promise<SessionAuthContextRecord | null> {
    return this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        deletedAt: null,
      },
      include: {
        user: true,
      },
    });
  }
}

@Injectable()
export class AuthSessionWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithBootstrapRecords(
    executor: PrismaTransactionalClient,
    input: {
      email: string | null;
      phone: string | null;
      passwordHash: string;
      lastActiveAt: Date;
    },
  ): Promise<{
    user: User;
    profile: UserProfile;
    discoveryPreference: UserDiscoveryPreference;
    communicationPreference: UserCommunicationPreference;
  }> {
    const user = await executor.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        lastActiveAt: input.lastActiveAt,
      },
    });

    const [profile, discoveryPreference, communicationPreference] =
      await Promise.all([
        executor.userProfile.create({
          data: {
            userId: user.id,
          },
        }),
        executor.userDiscoveryPreference.create({
          data: {
            userId: user.id,
          },
        }),
        executor.userCommunicationPreference.create({
          data: {
            userId: user.id,
          },
        }),
      ]);

    await executor.trustScore.create({
      data: {
        userId: user.id,
      },
    });

    return {
      user,
      profile,
      discoveryPreference,
      communicationPreference,
    };
  }

  async createSession(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      userId: string;
      deviceId: string | null;
      deviceName: string | null;
      platform: "IOS" | "ANDROID" | "WEB" | "UNKNOWN";
      appVersion: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      refreshTokenHash: string;
      refreshTokenJti: string;
      refreshTokenExpiresAt: Date;
      now: Date;
    },
  ): Promise<UserSession> {
    return executor.userSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        platform: input.platform,
        appVersion: input.appVersion,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        currentRefreshTokenHash: input.refreshTokenHash,
        currentRefreshTokenJti: input.refreshTokenJti,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        lastSeenAt: input.now,
      },
    });
  }

  async findReusableSession(
    userId: string,
    deviceId: string | null | undefined,
  ): Promise<UserSession | null> {
    if (!deviceId) {
      return null;
    }

    return this.prisma.userSession.findFirst({
      where: {
        userId,
        deviceId,
        revokedAt: null,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async rotateRefreshToken(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      currentRefreshTokenHash: string;
      currentRefreshTokenJti: string;
      refreshTokenExpiresAt: Date;
      previousRefreshTokenHash: string | null;
      previousRefreshTokenJti: string | null;
      previousRefreshTokenGraceUntil: Date | null;
      deviceName: string | null;
      appVersion: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      now: Date;
    },
  ): Promise<UserSession> {
    return executor.userSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        currentRefreshTokenHash: input.currentRefreshTokenHash,
        currentRefreshTokenJti: input.currentRefreshTokenJti,
        previousRefreshTokenHash: input.previousRefreshTokenHash,
        previousRefreshTokenJti: input.previousRefreshTokenJti,
        previousRefreshTokenGraceUntil: input.previousRefreshTokenGraceUntil,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        deviceName: input.deviceName,
        appVersion: input.appVersion,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        lastSeenAt: input.now,
      },
    });
  }

  async updateUserLastActiveAt(
    executor: PrismaTransactionalClient,
    userId: string,
    lastActiveAt: Date,
  ): Promise<void> {
    await executor.user.update({
      where: { id: userId },
      data: { lastActiveAt },
    });
  }

  async revokeSession(
    executor: PrismaTransactionalClient,
    input: {
      sessionId: string;
      reason: string;
      now: Date;
    },
  ): Promise<void> {
    await executor.userSession.update({
      where: { id: input.sessionId },
      data: {
        revokedAt: input.now,
        revokedReason: input.reason,
        currentRefreshTokenHash: "",
        previousRefreshTokenHash: null,
        previousRefreshTokenJti: null,
        previousRefreshTokenGraceUntil: null,
      },
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}
