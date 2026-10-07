import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import authConfig from "../../../config/auth.config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  ProfileCompletionService,
  type ProfileCompletionStatus,
} from "../../../common/services/profile-completion.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  normalizeEmail,
  normalizeIdentifier,
  normalizePhone,
} from "../../../common/utils/identifier.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { User, UserSession } from "../../../generated/prisma/client";
import type {
  AuthResponseDto,
  CurrentUserDto,
  DeviceContextDto,
  ProfileCompletionStatusDto,
  RefreshResponseDto,
  SessionDto,
  TokenPairDto,
} from "../dto/auth.dto";
import {
  AuthEligibilityService,
  CredentialVerificationService,
  PasswordPolicyService,
} from "../domain/auth.domain";
import {
  AuthSessionWriteRepository,
  AuthUserReadRepository,
  JwtTokenService,
  OpaqueRefreshTokenService,
  type LoginAccountRecord,
  PasswordHasherService,
} from "../infrastructure/auth.infrastructure";
import {
  LocalCredentialPolicy,
  RefreshTokenPolicy,
} from "../policies/auth.policies";

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthContextService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly authEligibilityService: AuthEligibilityService,
  ) {}

  async authenticateAccessToken(token: string): Promise<AuthContext> {
    const payload = await this.jwtTokenService.verifyAccessToken(token);
    const sessionContext =
      await this.authUserReadRepository.findSessionContextById(payload.sid);

    if (
      !sessionContext ||
      sessionContext.revokedAt ||
      sessionContext.deletedAt
    ) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Session is invalid",
      );
    }

    if (sessionContext.user.id !== payload.sub) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Session is invalid",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: sessionContext.user.status,
      deletedAt: sessionContext.user.deletedAt,
    });

    return {
      user: mapCurrentUser(sessionContext.user),
      session: mapSession(sessionContext, true),
      tokenJti: payload.jti,
    };
  }
}

@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localCredentialPolicy: LocalCredentialPolicy,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly tokenService: JwtTokenService,
    private readonly opaqueRefreshTokenService: OpaqueRefreshTokenService,
    private readonly auditLogService: AuditLogService,
    private readonly profileCompletionService: ProfileCompletionService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async execute(
    input: {
      email?: string | null;
      phone?: string | null;
      password: string;
      device: DeviceContextDto;
    },
    metadata: RequestMetadata,
    authMethod: "password" | "otp" = "password",
  ): Promise<AuthResponseDto> {
    this.localCredentialPolicy.assertSignupPayload(input);
    this.passwordPolicyService.assertValidForSignup({
      password: input.password,
      email: input.email ?? null,
      phone: input.phone ?? null,
    });

    const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
    const normalizedPhone = input.phone ? normalizePhone(input.phone) : null;

    if (normalizedEmail) {
      const existing =
        await this.authUserReadRepository.findByNormalizedIdentifier({
          type: "email",
          value: normalizedEmail,
        });
      if (existing) {
        throw new AppException(
          409,
          ERROR_CODES.AUTH_IDENTIFIER_TAKEN,
          "Identifier already in use",
        );
      }
    }

    if (normalizedPhone) {
      const existing =
        await this.authUserReadRepository.findByNormalizedIdentifier({
          type: "phone",
          value: normalizedPhone,
        });
      if (existing) {
        throw new AppException(
          409,
          ERROR_CODES.AUTH_IDENTIFIER_TAKEN,
          "Identifier already in use",
        );
      }
    }

    const passwordHash = await this.passwordHasherService.hash(input.password);
    const sessionId = randomUUID();
    const now = new Date();
    const refreshToken = this.opaqueRefreshTokenService.issue(sessionId);
    const refreshTokenExpiresAt = addDays(now, this.config.refreshTokenTtlDays);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const bootstrap =
          await this.authSessionWriteRepository.createUserWithBootstrapRecords(
            tx,
            {
              email: normalizedEmail,
              phone: normalizedPhone,
              passwordHash,
              lastActiveAt: now,
            },
          );

        const session = await this.authSessionWriteRepository.createSession(
          tx,
          {
            sessionId,
            userId: bootstrap.user.id,
            deviceId: input.device.deviceId ?? null,
            deviceName: input.device.deviceName ?? null,
            platform: input.device.platform,
            appVersion: input.device.appVersion ?? null,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            refreshTokenHash: refreshToken.tokenHash,
            refreshTokenJti: refreshToken.jti,
            refreshTokenExpiresAt,
            now,
          },
        );

        await this.auditLogService.write(
          {
            actorUserId: bootstrap.user.id,
            actorSessionId: session.id,
            action: authMethod === "otp" ? "auth.otp.signup" : "auth.signup",
            entityType: "User",
            entityId: bootstrap.user.id,
            targetUserId: bootstrap.user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            metadata: {
              sessionId: session.id,
              authMethod,
            },
          },
          tx,
        );

        return {
          user: bootstrap.user,
          profileCompletion: this.profileCompletionService.evaluate({
            accountIsActive: bootstrap.user.status === "ACTIVE",
            profileHidden: bootstrap.profile.isHidden,
            displayName: bootstrap.profile.displayName,
            bio: bootstrap.profile.bio,
            dateOfBirth: bootstrap.profile.dateOfBirth,
            city: bootstrap.profile.city,
            region: bootstrap.profile.region,
            countryCode: bootstrap.profile.countryCode,
            locationLat: bootstrap.profile.locationLat,
            locationLng: bootstrap.profile.locationLng,
            locationGeohash: bootstrap.profile.locationGeohash,
            activeIntentCount: 0,
            approvedPhotoCount: 0,
            approvedPrimaryPhotoCount: 0,
            discoveryPreference: {
              minAge: bootstrap.discoveryPreference.minAge,
              maxAge: bootstrap.discoveryPreference.maxAge,
              maxDistanceKm: bootstrap.discoveryPreference.maxDistanceKm,
            },
            communicationPreferenceExists: !!bootstrap.communicationPreference,
            completedAt: bootstrap.profile.completedAt,
          }),
          session,
        };
      });

      const accessToken = await this.tokenService.issueAccessToken(
        result.user,
        result.session.id,
      );

      return {
        tokens: mapTokenPair(
          accessToken,
          refreshToken.token,
          refreshTokenExpiresAt,
          result.session,
          true,
        ),
        user: mapCurrentUser(result.user),
        profileCompletion: mapProfileCompletion(result.profileCompletion),
      };
    } catch (error) {
      if (this.authSessionWriteRepository.isUniqueConstraintError(error)) {
        throw new AppException(
          409,
          ERROR_CODES.AUTH_IDENTIFIER_TAKEN,
          "Identifier already in use",
        );
      }

      throw error;
    }
  }
}

@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localCredentialPolicy: LocalCredentialPolicy,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly authEligibilityService: AuthEligibilityService,
    private readonly credentialVerificationService: CredentialVerificationService,
    private readonly tokenService: JwtTokenService,
    private readonly opaqueRefreshTokenService: OpaqueRefreshTokenService,
    private readonly auditLogService: AuditLogService,
    private readonly profileCompletionService: ProfileCompletionService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async execute(
    input: {
      identifier: string;
      password: string;
      device: DeviceContextDto;
    },
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    this.localCredentialPolicy.assertLoginPayload(input);

    let identifier: { type: "email" | "phone"; value: string };
    try {
      identifier = normalizeIdentifier(input.identifier);
    } catch {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    const account =
      await this.authUserReadRepository.findByNormalizedIdentifier(identifier);
    if (!account) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: account.status,
      deletedAt: account.deletedAt,
    });
    await this.credentialVerificationService.verifyOrThrow(
      input.password,
      account.passwordHash,
    );

    return this.createAuthenticatedSession(
      account,
      input.device,
      metadata,
      "password",
    );
  }

  async executeVerifiedPhone(
    phone: string,
    device: DeviceContextDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const account =
      await this.authUserReadRepository.findByNormalizedIdentifier({
        type: "phone",
        value: phone,
      });
    if (!account) {
      throw new AppException(
        404,
        ERROR_CODES.AUTH_OTP_ACCOUNT_NOT_FOUND,
        "No account uses this phone number",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: account.status,
      deletedAt: account.deletedAt,
    });

    return this.createAuthenticatedSession(account, device, metadata, "otp");
  }

  private async createAuthenticatedSession(
    account: LoginAccountRecord,
    device: DeviceContextDto,
    metadata: RequestMetadata,
    authMethod: "password" | "otp",
  ): Promise<AuthResponseDto> {
    const now = new Date();
    const reusableSession =
      await this.authSessionWriteRepository.findReusableSession(
        account.id,
        device.deviceId,
      );
    const sessionId = reusableSession?.id ?? randomUUID();
    const issuedRefreshToken = this.opaqueRefreshTokenService.issue(sessionId);
    const refreshTokenExpiresAt = addDays(now, this.config.refreshTokenTtlDays);

    const result = await this.prisma.$transaction(async (tx) => {
      const session = reusableSession
        ? await this.authSessionWriteRepository.rotateRefreshToken(tx, {
            sessionId: reusableSession.id,
            currentRefreshTokenHash: issuedRefreshToken.tokenHash,
            currentRefreshTokenJti: issuedRefreshToken.jti,
            previousRefreshTokenHash: reusableSession.currentRefreshTokenHash,
            previousRefreshTokenJti: reusableSession.currentRefreshTokenJti,
            previousRefreshTokenGraceUntil: addSeconds(
              now,
              this.config.refreshTokenGraceSeconds,
            ),
            refreshTokenExpiresAt,
            deviceName: device.deviceName ?? null,
            appVersion: device.appVersion ?? null,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            now,
          })
        : await this.authSessionWriteRepository.createSession(tx, {
            sessionId,
            userId: account.id,
            deviceId: device.deviceId ?? null,
            deviceName: device.deviceName ?? null,
            platform: device.platform,
            appVersion: device.appVersion ?? null,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            refreshTokenHash: issuedRefreshToken.tokenHash,
            refreshTokenJti: issuedRefreshToken.jti,
            refreshTokenExpiresAt,
            now,
          });

      await this.authSessionWriteRepository.updateUserLastActiveAt(
        tx,
        account.id,
        now,
      );

      await this.auditLogService.write(
        {
          actorUserId: account.id,
          actorSessionId: session.id,
          action:
            authMethod === "otp"
              ? reusableSession
                ? "auth.otp.login.reuse-session"
                : "auth.otp.login"
              : reusableSession
                ? "auth.login.reuse-session"
                : "auth.login",
          entityType: "UserSession",
          entityId: session.id,
          targetUserId: account.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            reusedSession: !!reusableSession,
            authMethod,
          },
        },
        tx,
      );

      return {
        session,
      };
    });

    const accessToken = await this.tokenService.issueAccessToken(
      {
        ...account,
        lastActiveAt: now,
      },
      result.session.id,
    );

    return {
      tokens: mapTokenPair(
        accessToken,
        issuedRefreshToken.token,
        refreshTokenExpiresAt,
        result.session,
        true,
      ),
      user: mapCurrentUser({
        ...account,
        lastActiveAt: now,
      }),
      profileCompletion: mapProfileCompletion(
        evaluateAccountProfileCompletion(
          this.profileCompletionService,
          account,
        ),
      ),
    };
  }
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokenPolicy: RefreshTokenPolicy,
    private readonly authUserReadRepository: AuthUserReadRepository,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly authEligibilityService: AuthEligibilityService,
    private readonly opaqueRefreshTokenService: OpaqueRefreshTokenService,
    private readonly tokenService: JwtTokenService,
    private readonly auditLogService: AuditLogService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async execute(
    input: { refreshToken: string },
    metadata: RequestMetadata,
  ): Promise<RefreshResponseDto> {
    this.refreshTokenPolicy.assertPayload(input);

    const parsed = this.opaqueRefreshTokenService.parseOrThrow(
      input.refreshToken,
    );
    const sessionContext =
      await this.authUserReadRepository.findSessionContextById(
        parsed.sessionId,
      );

    if (
      !sessionContext ||
      sessionContext.revokedAt ||
      sessionContext.deletedAt ||
      sessionContext.refreshTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    this.authEligibilityService.assertCanAuthenticate({
      status: sessionContext.user.status,
      deletedAt: sessionContext.user.deletedAt,
    });

    const now = new Date();
    const matchesCurrent =
      parsed.jti === sessionContext.currentRefreshTokenJti &&
      this.opaqueRefreshTokenService.matches(
        input.refreshToken,
        sessionContext.currentRefreshTokenHash,
      );
    const matchesPrevious =
      parsed.jti === sessionContext.previousRefreshTokenJti &&
      this.opaqueRefreshTokenService.matches(
        input.refreshToken,
        sessionContext.previousRefreshTokenHash,
      );

    if (!matchesCurrent && !matchesPrevious) {
      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        "Invalid refresh token",
      );
    }

    if (
      matchesPrevious &&
      (!sessionContext.previousRefreshTokenGraceUntil ||
        sessionContext.previousRefreshTokenGraceUntil.getTime() < now.getTime())
    ) {
      await this.prisma.$transaction(async (tx) => {
        await this.authSessionWriteRepository.revokeSession(tx, {
          sessionId: sessionContext.id,
          reason: "refresh_replay_detected",
          now,
        });
        await this.auditLogService.write(
          {
            actorUserId: sessionContext.user.id,
            actorSessionId: sessionContext.id,
            action: "auth.refresh.replay-detected",
            entityType: "UserSession",
            entityId: sessionContext.id,
            targetUserId: sessionContext.user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
          tx,
        );
      });

      throw new AppException(
        401,
        ERROR_CODES.AUTH_REFRESH_REPLAY_DETECTED,
        "Refresh token replay detected",
      );
    }

    const issuedRefreshToken = this.opaqueRefreshTokenService.issue(
      sessionContext.id,
    );
    const refreshTokenExpiresAt = addDays(now, this.config.refreshTokenTtlDays);

    const session = await this.prisma.$transaction(async (tx) => {
      const rotatedSession =
        await this.authSessionWriteRepository.rotateRefreshToken(tx, {
          sessionId: sessionContext.id,
          currentRefreshTokenHash: issuedRefreshToken.tokenHash,
          currentRefreshTokenJti: issuedRefreshToken.jti,
          previousRefreshTokenHash: sessionContext.currentRefreshTokenHash,
          previousRefreshTokenJti: sessionContext.currentRefreshTokenJti,
          previousRefreshTokenGraceUntil: addSeconds(
            now,
            this.config.refreshTokenGraceSeconds,
          ),
          refreshTokenExpiresAt,
          deviceName: sessionContext.deviceName,
          appVersion: sessionContext.appVersion,
          ipAddress: metadata.ipAddress ?? sessionContext.ipAddress,
          userAgent: metadata.userAgent ?? sessionContext.userAgent,
          now,
        });

      await this.authSessionWriteRepository.updateUserLastActiveAt(
        tx,
        sessionContext.user.id,
        now,
      );

      await this.auditLogService.write(
        {
          actorUserId: sessionContext.user.id,
          actorSessionId: sessionContext.id,
          action: "auth.refresh",
          entityType: "UserSession",
          entityId: sessionContext.id,
          targetUserId: sessionContext.user.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        tx,
      );

      return rotatedSession;
    });

    const accessToken = await this.tokenService.issueAccessToken(
      {
        ...sessionContext.user,
        lastActiveAt: now,
      },
      session.id,
    );

    return {
      tokens: mapTokenPair(
        accessToken,
        issuedRefreshToken.token,
        refreshTokenExpiresAt,
        session,
        true,
      ),
      user: mapCurrentUser({
        ...sessionContext.user,
        lastActiveAt: now,
      }),
    };
  }
}

@Injectable()
export class LogoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessionWriteRepository: AuthSessionWriteRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(
    authContext: AuthContext,
    metadata: RequestMetadata,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.authSessionWriteRepository.revokeSession(tx, {
        sessionId: authContext.session.id,
        reason: "logout",
        now,
      });

      await this.auditLogService.write(
        {
          actorUserId: authContext.user.id,
          actorSessionId: authContext.session.id,
          action: "auth.logout",
          entityType: "UserSession",
          entityId: authContext.session.id,
          targetUserId: authContext.user.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        tx,
      );
    });
  }
}

function evaluateAccountProfileCompletion(
  profileCompletionService: ProfileCompletionService,
  account: LoginAccountRecord,
): ProfileCompletionStatus {
  return profileCompletionService.evaluate({
    accountIsActive: account.status === "ACTIVE" && account.deletedAt === null,
    profileHidden: account.profile?.isHidden ?? false,
    displayName: account.profile?.displayName ?? null,
    bio: account.profile?.bio ?? null,
    dateOfBirth: account.profile?.dateOfBirth ?? null,
    city: account.profile?.city ?? null,
    region: account.profile?.region ?? null,
    countryCode: account.profile?.countryCode ?? null,
    locationLat: account.profile?.locationLat ?? null,
    locationLng: account.profile?.locationLng ?? null,
    locationGeohash: account.profile?.locationGeohash ?? null,
    activeIntentCount: account.intents.length,
    approvedPhotoCount: account.photos.length,
    approvedPrimaryPhotoCount: account.photos.filter((photo) => photo.isPrimary)
      .length,
    discoveryPreference: account.discoveryPreference
      ? {
          minAge: account.discoveryPreference.minAge,
          maxAge: account.discoveryPreference.maxAge,
          maxDistanceKm: account.discoveryPreference.maxDistanceKm,
        }
      : null,
    communicationPreferenceExists: !!account.communicationPreference,
    completedAt: account.profile?.completedAt ?? null,
  });
}

function mapTokenPair(
  accessToken: { token: string; expiresAt: Date },
  refreshToken: string,
  refreshTokenExpiresAt: Date,
  session: UserSession,
  isCurrent: boolean,
): TokenPairDto {
  return {
    accessToken: accessToken.token,
    accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    session: mapSession(session, isCurrent),
  };
}

function mapSession(session: UserSession, isCurrent: boolean): SessionDto {
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

function mapCurrentUser(user: User): CurrentUserDto {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isShadowBanned: user.isShadowBanned,
    isDiscoveryFrozen: user.isDiscoveryFrozen,
    isChatFrozen: user.isChatFrozen,
    isCallFrozen: user.isCallFrozen,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function mapProfileCompletion(
  value: ProfileCompletionStatus,
): ProfileCompletionStatusDto {
  return {
    isComplete: value.isComplete,
    completedAt: value.completedAt?.toISOString() ?? null,
    missingCriteria: value.missingCriteria,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addSeconds(date: Date, seconds: number): Date {
  const next = new Date(date);
  next.setUTCSeconds(next.getUTCSeconds() + seconds);
  return next;
}
