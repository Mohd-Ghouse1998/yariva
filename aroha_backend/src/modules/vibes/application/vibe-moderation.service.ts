import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../../common/services/audit-log.service";
import { PrismaService } from "../../../database/prisma/prisma.service";

export type VibeModerationDecision = "APPROVED" | "REJECTED";

@Injectable()
export class VibeModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async review(input: {
    vibeId: string;
    decision: VibeModerationDecision;
    provider: string;
    reason?: string | null;
    actorUserId?: string | null;
    actorSessionId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<boolean> {
    const vibe = await this.prisma.vibeMedia.findUnique({
      where: { id: input.vibeId },
    });
    if (
      !vibe ||
      vibe.deletedAt ||
      vibe.status !== "PROCESSING" ||
      vibe.moderationStatus !== "PENDING" ||
      !vibe.processedBucket ||
      !vibe.processedObjectKey ||
      !vibe.thumbnailBucket ||
      !vibe.thumbnailObjectKey ||
      !vibe.processingCompletedAt
    ) {
      return false;
    }

    const approved = input.decision === "APPROVED";
    const now = new Date();
    let applied = false;
    await this.prisma.$transaction(async (tx) => {
      const update = await tx.vibeMedia.updateMany({
        where: {
          id: vibe.id,
          status: "PROCESSING",
          moderationStatus: "PENDING",
          deletedAt: null,
        },
        data: {
          status: approved ? "READY" : "REJECTED",
          moderationStatus: input.decision,
          moderationProvider: input.provider.slice(0, 80),
          moderationReason: approved ? null : (input.reason ?? "Rejected by content moderation").slice(0, 500),
          moderatedAt: now,
          readyAt: approved ? now : null,
          failureReason: approved ? null : (input.reason ?? "Vibe did not pass content review").slice(0, 500),
        },
      });
      if (update.count === 0) return;
      applied = true;

      if (approved) {
        await tx.vibeMedia.updateMany({
          where: {
            userId: vibe.userId,
            id: { not: vibe.id },
            status: "READY",
            deletedAt: null,
          },
          data: { status: "REMOVED", deletedAt: now },
        });
      }

      await this.auditLogService.write(
        {
          actorUserId: input.actorUserId ?? null,
          actorSessionId: input.actorSessionId ?? null,
          action: approved ? "vibe.moderation.approve" : "vibe.moderation.reject",
          entityType: "VibeMedia",
          entityId: vibe.id,
          targetUserId: vibe.userId,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          metadata: {
            provider: input.provider,
            reason: input.reason ?? null,
          },
        },
        tx,
      );
    });

    return applied;
  }
}
