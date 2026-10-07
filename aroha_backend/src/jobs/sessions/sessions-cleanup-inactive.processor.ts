import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class SessionsCleanupInactiveProcessor {
  constructor(private readonly prisma: PrismaService) {}

  async process(_job: Job): Promise<void> {
    const now = new Date();
    const expiredSessions = await this.prisma.userSession.findMany({
      where: {
        refreshTokenExpiresAt: { lt: now },
        deletedAt: null,
      },
      select: { id: true },
      take: 500,
    });

    if (expiredSessions.length === 0) {
      return;
    }

    const sessionIds = expiredSessions.map((session) => session.id);
    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({
        where: { id: { in: sessionIds } },
        data: {
          revokedAt: now,
          revokedReason: "session_expired_cleanup",
          deletedAt: now,
          currentRefreshTokenHash: "",
          previousRefreshTokenHash: null,
          previousRefreshTokenJti: null,
          previousRefreshTokenGraceUntil: null,
        },
      }),
      this.prisma.pushToken.updateMany({
        where: { sessionId: { in: sessionIds }, deletedAt: null },
        data: {
          invalidatedAt: now,
          deletedAt: now,
        },
      }),
    ]);
  }
}

