import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";

export interface AuditLogInput {
  actorUserId?: string | null;
  actorSessionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

type AuditExecutor = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditLogInput, executor?: AuditExecutor): Promise<void> {
    const db = executor ?? this.prisma;

    await db.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorSessionId: entry.actorSessionId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        targetUserId: entry.targetUserId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ?? {},
      },
    });
  }
}
