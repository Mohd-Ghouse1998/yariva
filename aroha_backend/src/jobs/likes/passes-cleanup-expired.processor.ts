import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class PassesCleanupExpiredProcessor {
  constructor(private readonly prisma: PrismaService) {}

  async process(_job: Job): Promise<void> {
    const now = new Date();
    await this.prisma.pass.updateMany({
      where: {
        expiresAt: { lt: now },
        deletedAt: null,
      },
      data: { deletedAt: now },
    });
  }
}

