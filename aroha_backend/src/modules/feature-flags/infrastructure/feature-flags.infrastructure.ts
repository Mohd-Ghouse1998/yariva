import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { FeatureFlag, Prisma } from "../../../generated/prisma/client";

@Injectable()
export class FeatureFlagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<FeatureFlag[]> {
    return this.prisma.featureFlag.findMany({
      where: { deletedAt: null },
      orderBy: { key: "asc" },
    });
  }

  async findByKey(key: string): Promise<FeatureFlag | null> {
    return this.prisma.featureFlag.findUnique({ where: { key } });
  }

  async upsert(
    executor: PrismaTransactionalClient,
    input: {
      key: string;
      description: string | null;
      scope: "GLOBAL" | "USER_PERCENTAGE" | "USER_ALLOWLIST";
      enabled: boolean;
      rolloutPercentage: number | null;
      variant: string | null;
      config: Prisma.InputJsonValue;
      allowlistUserIds: Prisma.InputJsonValue;
      createdByUserId: string | null;
    },
  ): Promise<FeatureFlag> {
    return executor.featureFlag.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        description: input.description,
        scope: input.scope,
        enabled: input.enabled,
        rolloutPercentage: input.rolloutPercentage,
        variant: input.variant,
        config: input.config,
        allowlistUserIds: input.allowlistUserIds,
        createdByUserId: input.createdByUserId,
      },
      update: {
        description: input.description,
        scope: input.scope,
        enabled: input.enabled,
        rolloutPercentage: input.rolloutPercentage,
        variant: input.variant,
        config: input.config,
        allowlistUserIds: input.allowlistUserIds,
        deletedAt: null,
      },
    });
  }
}

