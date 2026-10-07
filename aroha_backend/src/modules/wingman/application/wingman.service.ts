import { Inject, Injectable } from "@nestjs/common";
import { DuoRevocationService } from "../../conversations/application/duo-revocation.service";
import { ConfigType } from "@nestjs/config";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import {
  hashWithPepper,
  randomBase64Url,
} from "../../../common/utils/crypto.util";
import { normalizeIdentifier } from "../../../common/utils/identifier.util";
import wingmanConfig from "../../../config/wingman.config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { Prisma } from "../../../generated/prisma/client";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { CreateNotificationService } from "../../notifications/application/notifications.services";
import type {
  CreateWingmanInvitationDto,
  RespondWingmanInvitationDto,
  WingmanCapabilitiesDto,
  WingmanPartyDto,
  WingmanSceneConsentDto,
  WingmanStateDto,
} from "../dto/wingman.dto";
import { DuoDiscoveryCache } from "../infrastructure/duo-discovery.cache";

const partyInclude = {
  invitation: true,
  members: {
    include: {
      user: {
        select: { id: true, profile: { select: { displayName: true } } },
      },
      consentedScene: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.WingmanPartyInclude;

type PartyGraph = Prisma.WingmanPartyGetPayload<{
  include: typeof partyInclude;
}>;

@Injectable()
export class WingmanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: EvaluateFeatureFlagService,
    private readonly notifications: CreateNotificationService,
    private readonly audit: AuditLogService,
    private readonly discoveryCache: DuoDiscoveryCache,
    @Inject(wingmanConfig.KEY)
    private readonly config: ConfigType<typeof wingmanConfig>,
    private readonly duoRevocation: DuoRevocationService,
  ) {}

  async capabilities(userId: string): Promise<WingmanCapabilitiesDto> {
    const flag = await this.featureFlags.execute({ key: "wingman.v1", userId });
    return {
      enabled: flag.enabled,
      invitationTtlHours: this.config.invitationTtlHours,
    };
  }

  async getMine(userId: string): Promise<WingmanStateDto> {
    await this.assertEnabled(userId);
    await this.expirePendingForUser(userId);
    const current = await this.prisma.wingmanPartyMember.findFirst({
      where: { userId, status: { in: ["RESERVED", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      include: { party: { include: partyInclude } },
    });
    const membership =
      current ??
      (await this.prisma.wingmanPartyMember.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { party: { include: partyInclude } },
      }));
    if (!membership) return { state: "NONE", party: null };
    return this.toState(userId, membership.party);
  }

  async invite(input: {
    userId: string;
    sessionId: string;
    payload: CreateWingmanInvitationDto;
  }): Promise<WingmanStateDto & { deepLink: string }> {
    await this.assertEnabled(input.userId);
    const identifier = normalizeIdentifier(input.payload.identifier);
    const invitee = await this.prisma.user.findFirst({
      where: {
        ...(identifier.type === "email"
          ? { email: identifier.value }
          : { phone: identifier.value }),
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    if (!invitee) {
      throw new AppException(
        404,
        ERROR_CODES.WINGMAN_INVITEE_NOT_FOUND,
        "That account is not available for Duo",
      );
    }
    if (invitee.id === input.userId) {
      throw new AppException(
        400,
        ERROR_CODES.WINGMAN_SELF_INVITE,
        "Invite a trusted friend, not yourself",
      );
    }
    const blocked = await this.prisma.block.count({
      where: {
        deletedAt: null,
        OR: [
          { blockerId: input.userId, blockedId: invitee.id },
          { blockerId: invitee.id, blockedId: input.userId },
        ],
      },
    });
    if (blocked) {
      throw new AppException(
        403,
        ERROR_CODES.WINGMAN_BLOCKED,
        "This account cannot be invited",
      );
    }

    await Promise.all([
      this.expirePendingForUser(input.userId),
      this.expirePendingForUser(invitee.id),
    ]);
    const token = randomBase64Url(32);
    const tokenHash = hashWithPepper(token, this.config.tokenPepper);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.invitationTtlHours * 60 * 60 * 1000,
    );

    let partyId: string;
    let invitationId: string;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        for (const userId of [input.userId, invitee.id].sort()) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
        }
        const existing = await tx.wingmanPartyMember.count({
          where: {
            userId: { in: [input.userId, invitee.id] },
            status: { in: ["RESERVED", "ACTIVE"] },
          },
        });
        if (existing) this.throwPartyConflict();

        const party = await tx.wingmanParty.create({
          data: { createdByUserId: input.userId, status: "PENDING" },
        });
        await tx.wingmanPartyMember.createMany({
          data: [
            {
              partyId: party.id,
              userId: input.userId,
              role: "OWNER",
              status: "ACTIVE",
              joinedAt: now,
            },
            {
              partyId: party.id,
              userId: invitee.id,
              role: "BUDDY",
              status: "RESERVED",
            },
          ],
        });
        const invitation = await tx.wingmanInvitation.create({
          data: {
            partyId: party.id,
            inviterUserId: input.userId,
            inviteeUserId: invitee.id,
            tokenHash,
            expiresAt,
          },
        });
        await this.audit.write(
          {
            actorUserId: input.userId,
            actorSessionId: input.sessionId,
            action: "wingman.invitation.create",
            entityType: "WingmanInvitation",
            entityId: invitation.id,
            targetUserId: invitee.id,
            metadata: { partyId: party.id, expiresAt: expiresAt.toISOString() },
          },
          tx,
        );
        return { partyId: party.id, invitationId: invitation.id };
      });
      partyId = result.partyId;
      invitationId = result.invitationId;
    } catch (error) {
      if (isUniqueConflict(error) || isPartyConflict(error))
        this.throwPartyConflict();
      throw error;
    }

    const inviter = await this.displayName(input.userId);
    const deepLink = `${this.config.deepLinkBase}/${encodeURIComponent(token)}`;
    await this.notifications
      .execute({
        userId: invitee.id,
        actorUserId: input.userId,
        type: "SYSTEM",
        title: "Duo invite",
        body: `${inviter} invited you to create a Duo.`,
        // Keep the recoverable token out of persisted notification data. The
        // authenticated invitee can act on their reserved invitation in-app;
        // only the one-time create response exposes the shareable deep link.
        data: { route: "yariva://wingman", partyId },
        dedupeKey: `wingman-invite:${invitationId}`,
      })
      .catch(() => undefined);
    return { ...(await this.getMine(input.userId)), deepLink };
  }

  async accept(input: {
    userId: string;
    sessionId: string;
    payload: RespondWingmanInvitationDto;
  }): Promise<WingmanStateDto> {
    await this.assertEnabled(input.userId);
    const invitation = await this.resolvePendingInvitation(
      input.userId,
      input.payload.token,
    );
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invitation.partyId}, 0))`;
      const pending = await tx.wingmanInvitation.findFirst({
        where: {
          id: invitation.id,
          inviteeUserId: input.userId,
          status: "PENDING",
        },
      });
      if (!pending) this.throwInvalidInvite();
      await tx.wingmanInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", consumedAt: now },
      });
      await tx.wingmanPartyMember.update({
        where: {
          partyId_userId: { partyId: invitation.partyId, userId: input.userId },
        },
        data: { status: "ACTIVE", joinedAt: now },
      });
      await tx.wingmanParty.update({
        where: { id: invitation.partyId },
        data: {
          status: "ACTIVE",
          activatedAt: now,
          membershipVersion: { increment: 1 },
        },
      });
      await this.audit.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "wingman.invitation.accept",
          entityType: "WingmanInvitation",
          entityId: invitation.id,
          targetUserId: invitation.inviterUserId,
          metadata: { partyId: invitation.partyId },
        },
        tx,
      );
    });
    const inviteeName = await this.displayName(input.userId);
    await this.notifications
      .execute({
        userId: invitation.inviterUserId,
        actorUserId: input.userId,
        type: "SYSTEM",
        title: "Your Duo is connected",
        body: `${inviteeName} accepted your Duo invite.`,
        data: { route: "yariva://wingman", partyId: invitation.partyId },
        dedupeKey: `wingman-accepted:${invitation.id}`,
      })
      .catch(() => undefined);
    return this.getMine(input.userId);
  }

  async decline(input: {
    userId: string;
    sessionId: string;
    payload: RespondWingmanInvitationDto;
  }): Promise<WingmanStateDto> {
    await this.assertEnabled(input.userId);
    const invitation = await this.resolvePendingInvitation(
      input.userId,
      input.payload.token,
    );
    await this.disconnectPendingParty({
      invitationId: invitation.id,
      partyId: invitation.partyId,
      actorUserId: input.userId,
      actorSessionId: input.sessionId,
      targetUserId: invitation.inviterUserId,
      invitationStatus: "DECLINED",
      action: "wingman.invitation.decline",
    });
    await this.notifications
      .execute({
        userId: invitation.inviterUserId,
        actorUserId: input.userId,
        type: "SYSTEM",
        title: "Duo invite declined",
        body: "Your friend did not join this Duo.",
        data: { route: "yariva://wingman" },
        dedupeKey: `wingman-declined:${invitation.id}`,
      })
      .catch(() => undefined);
    return this.getMine(input.userId);
  }

  async cancel(input: {
    userId: string;
    sessionId: string;
    invitationId: string;
  }): Promise<WingmanStateDto> {
    await this.assertEnabled(input.userId);
    const invitation = await this.prisma.wingmanInvitation.findFirst({
      where: {
        id: input.invitationId,
        inviterUserId: input.userId,
        status: "PENDING",
      },
    });
    if (!invitation) this.throwInvalidInvite();
    await this.disconnectPendingParty({
      invitationId: invitation.id,
      partyId: invitation.partyId,
      actorUserId: input.userId,
      actorSessionId: input.sessionId,
      targetUserId: invitation.inviteeUserId,
      invitationStatus: "CANCELLED",
      action: "wingman.invitation.cancel",
    });
    return this.getMine(input.userId);
  }

  async leave(input: {
    userId: string;
    sessionId: string;
    partyId: string;
  }): Promise<WingmanStateDto> {
    await this.assertEnabled(input.userId);
    const membership = await this.prisma.wingmanPartyMember.findFirst({
      where: { partyId: input.partyId, userId: input.userId, status: "ACTIVE" },
      include: { party: { include: { members: true } } },
    });
    if (!membership || membership.party.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.WINGMAN_PARTY_NOT_ACTIVE,
        "This Duo is not active",
      );
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.partyId}, 0))`;
      await tx.wingmanParty.update({
        where: { id: input.partyId },
        data: {
          status: "DISCONNECTED",
          disconnectedAt: now,
          membershipVersion: { increment: 1 },
        },
      });
      await tx.wingmanPartyMember.updateMany({
        where: {
          partyId: input.partyId,
          status: { in: ["ACTIVE", "RESERVED"] },
        },
        data: { status: "DISCONNECTED", disconnectedAt: now },
      });
      await tx.wingmanPairMatch.updateMany({
        where: {
          status: "ACTIVE",
          OR: [{ partyLowId: input.partyId }, { partyHighId: input.partyId }],
        },
        data: { status: "ENDED", endedAt: now },
      });
      await this.audit.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "wingman.party.leave",
          entityType: "WingmanParty",
          entityId: input.partyId,
          metadata: {
            membershipVersion: membership.party.membershipVersion + 1,
          },
        },
        tx,
      );
    });
    await this.duoRevocation.publishClosed({ duoMatch: { OR: [{ partyLowId: input.partyId }, { partyHighId: input.partyId }] } });
    const buddy = membership.party.members.find(
      (member) => member.userId !== input.userId,
    );
    if (buddy) {
      await this.notifications
        .execute({
          userId: buddy.userId,
          actorUserId: input.userId,
          type: "SYSTEM",
          title: "Duo ended",
          body: "Your friend disconnected the Duo.",
          data: { route: "yariva://wingman" },
          dedupeKey: `wingman-left:${input.partyId}:${membership.party.membershipVersion + 1}`,
        })
        .catch(() => undefined);
    }
    await this.discoveryCache.bump().catch(() => undefined);
    return this.getMine(input.userId);
  }

  async consentScene(input: {
    userId: string;
    sessionId: string;
    partyId: string;
    payload: WingmanSceneConsentDto;
  }): Promise<WingmanStateDto> {
    await this.assertEnabled(input.userId);
    const now = new Date();
    const [membership, scene] = await Promise.all([
      this.prisma.wingmanPartyMember.findFirst({
        where: {
          partyId: input.partyId,
          userId: input.userId,
          status: "ACTIVE",
        },
        include: { party: true },
      }),
      this.prisma.scene.findFirst({
        where: {
          id: input.payload.sceneId,
          ownerId: input.userId,
          version: input.payload.sceneVersion,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
      }),
    ]);
    if (!membership || membership.party.status !== "ACTIVE") {
      throw new AppException(
        409,
        ERROR_CODES.WINGMAN_PARTY_NOT_ACTIVE,
        "Connect your Duo before approving a Scene",
      );
    }
    if (!scene) {
      throw new AppException(
        409,
        ERROR_CODES.WINGMAN_SCENE_INVALID,
        "Choose your current active Scene",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.wingmanPartyMember.update({
        where: {
          partyId_userId: { partyId: input.partyId, userId: input.userId },
        },
        data: {
          consentedSceneId: scene.id,
          consentedSceneVersion: scene.version,
          sceneConsentedAt: now,
        },
      });
      await this.audit.write(
        {
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "wingman.scene.consent",
          entityType: "WingmanParty",
          entityId: input.partyId,
          metadata: { sceneId: scene.id, sceneVersion: scene.version },
        },
        tx,
      );
    });
    await this.discoveryCache.bump().catch(() => undefined);
    return this.getMine(input.userId);
  }

  private async resolvePendingInvitation(userId: string, token?: string) {
    const invitation = await this.prisma.wingmanInvitation.findFirst({
      where: token
        ? {
            inviteeUserId: userId,
            tokenHash: hashWithPepper(token.trim(), this.config.tokenPepper),
            status: "PENDING",
          }
        : { inviteeUserId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!invitation) this.throwInvalidInvite();
    if (invitation.expiresAt <= new Date()) {
      await this.expirePendingForUser(userId);
      throw new AppException(
        410,
        ERROR_CODES.WINGMAN_INVITE_EXPIRED,
        "This Duo invite has expired",
      );
    }
    return invitation;
  }

  private async disconnectPendingParty(input: {
    invitationId: string;
    partyId: string;
    actorUserId: string;
    actorSessionId: string;
    targetUserId: string;
    invitationStatus: "DECLINED" | "CANCELLED";
    action: string;
  }): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.partyId}, 0))`;
      const pending = await tx.wingmanInvitation.findFirst({
        where: { id: input.invitationId, status: "PENDING" },
      });
      if (!pending) this.throwInvalidInvite();
      await tx.wingmanInvitation.update({
        where: { id: input.invitationId },
        data: {
          status: input.invitationStatus,
          ...(input.invitationStatus === "DECLINED"
            ? { declinedAt: now }
            : { cancelledAt: now }),
        },
      });
      await tx.wingmanParty.update({
        where: { id: input.partyId },
        data: {
          status: "DISCONNECTED",
          disconnectedAt: now,
          membershipVersion: { increment: 1 },
        },
      });
      await tx.wingmanPartyMember.updateMany({
        where: {
          partyId: input.partyId,
          status: { in: ["ACTIVE", "RESERVED"] },
        },
        data: { status: "DISCONNECTED", disconnectedAt: now },
      });
      await this.audit.write(
        {
          actorUserId: input.actorUserId,
          actorSessionId: input.actorSessionId,
          action: input.action,
          entityType: "WingmanInvitation",
          entityId: input.invitationId,
          targetUserId: input.targetUserId,
          metadata: { partyId: input.partyId },
        },
        tx,
      );
    });
  }

  private async expirePendingForUser(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const expired = await tx.wingmanInvitation.findMany({
        where: {
          status: "PENDING",
          expiresAt: { lte: now },
          OR: [{ inviterUserId: userId }, { inviteeUserId: userId }],
        },
        select: { id: true, partyId: true },
      });
      if (!expired.length) return;
      const invitationIds = expired.map((item) => item.id);
      const partyIds = expired.map((item) => item.partyId);
      await tx.wingmanInvitation.updateMany({
        where: { id: { in: invitationIds }, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      await tx.wingmanParty.updateMany({
        where: { id: { in: partyIds }, status: "PENDING" },
        data: {
          status: "DISCONNECTED",
          disconnectedAt: now,
          membershipVersion: { increment: 1 },
        },
      });
      await tx.wingmanPartyMember.updateMany({
        where: {
          partyId: { in: partyIds },
          status: { in: ["ACTIVE", "RESERVED"] },
        },
        data: { status: "DISCONNECTED", disconnectedAt: now },
      });
    });
  }

  private toState(userId: string, party: PartyGraph): WingmanStateDto {
    const own = party.members.find((member) => member.userId === userId);
    if (!own) return { state: "NONE", party: null };
    const other = party.members.find((member) => member.userId !== userId);
    const now = new Date();
    const consentCurrent = (
      member: PartyGraph["members"][number] | undefined,
    ) =>
      Boolean(
        member?.consentedScene &&
        member.consentedScene.status === "ACTIVE" &&
        member.consentedScene.expiresAt > now &&
        member.consentedScene.version === member.consentedSceneVersion,
      );
    const ownConsentCurrent = consentCurrent(own);
    const buddyConsentCurrent = consentCurrent(other);
    const revealBuddy =
      party.status === "ACTIVE" || party.invitation?.status === "ACCEPTED";
    const dto: WingmanPartyDto = {
      id: party.id,
      status: party.status,
      membershipVersion: party.membershipVersion,
      role: own.role,
      buddy:
        revealBuddy && other
          ? {
              userId: other.userId,
              displayName:
                other.user.profile?.displayName?.trim() || "Yariva member",
            }
          : null,
      invitation: party.invitation
        ? {
            id: party.invitation.id,
            status: party.invitation.status,
            direction:
              party.invitation.inviterUserId === userId ? "SENT" : "RECEIVED",
            expiresAt: party.invitation.expiresAt.toISOString(),
            inviter:
              party.invitation.inviteeUserId === userId
                ? {
                    userId: party.invitation.inviterUserId,
                    displayName:
                      party.members
                        .find(
                          (member) =>
                            member.userId === party.invitation?.inviterUserId,
                        )
                        ?.user.profile?.displayName?.trim() ||
                      "A Yariva friend",
                  }
                : null,
          }
        : null,
      sceneConsent: {
        current: ownConsentCurrent,
        sceneId: own.consentedSceneId,
        sceneVersion: own.consentedSceneVersion,
      },
      buddySceneConsented: buddyConsentCurrent,
      bothSceneConsented:
        party.status === "ACTIVE" && ownConsentCurrent && buddyConsentCurrent,
      activatedAt: party.activatedAt?.toISOString() ?? null,
      disconnectedAt: party.disconnectedAt?.toISOString() ?? null,
    };
    return {
      state:
        party.status === "PENDING"
          ? "PENDING"
          : party.status === "ACTIVE"
            ? "ACTIVE"
            : "DISCONNECTED",
      party: dto,
    };
  }

  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profile: { select: { displayName: true } } },
    });
    return user?.profile?.displayName?.trim() || "Your friend";
  }

  private async assertEnabled(userId: string): Promise<void> {
    const flag = await this.featureFlags.execute({ key: "wingman.v1", userId });
    if (!flag.enabled) {
      throw new AppException(
        404,
        ERROR_CODES.WINGMAN_NOT_AVAILABLE,
        "Duo is not available",
      );
    }
  }

  private throwPartyConflict(): never {
    throw new AppException(
      409,
      ERROR_CODES.WINGMAN_PARTY_CONFLICT,
      "One of you already has an active or pending Duo",
    );
  }

  private throwInvalidInvite(): never {
    throw new AppException(
      404,
      ERROR_CODES.WINGMAN_INVITE_INVALID,
      "This Duo invite is no longer valid",
    );
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isPartyConflict(error: unknown): boolean {
  return (
    error instanceof AppException &&
    error.code === ERROR_CODES.WINGMAN_PARTY_CONFLICT
  );
}
