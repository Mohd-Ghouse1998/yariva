import { Injectable } from "@nestjs/common";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { FeatureFlag, Prisma } from "../../../generated/prisma/client";
import { FEATURE_FLAG_EVENTS } from "../events/feature-flag.events";
import type {
  FeatureFlagDto,
  FeatureFlagEvaluation,
  FeatureFlagListDto,
  FeatureFlagResponseDto,
  UpsertFeatureFlagDto,
} from "../dto/feature-flags.dto";
import { FeatureFlagRuleService } from "../domain/feature-flags.domain";
import { FeatureFlagRepository } from "../infrastructure/feature-flags.infrastructure";

@Injectable()
export class ListFeatureFlagsService {
  constructor(private readonly repository: FeatureFlagRepository) {}

  async execute(): Promise<FeatureFlagListDto> {
    const flags = await this.repository.list();
    return {
      items: flags.map(mapFeatureFlag),
      nextCursor: null,
    };
  }
}

@Injectable()
export class UpsertFeatureFlagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: FeatureFlagRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: {
    key: string;
    payload: UpsertFeatureFlagDto;
    actorUserId: string | null;
  }): Promise<FeatureFlagResponseDto> {
    const flag = await this.prisma.$transaction((tx) =>
      this.repository.upsert(tx, {
        key: input.key,
        description: input.payload.description ?? null,
        scope: input.payload.scope,
        enabled: input.payload.enabled,
        rolloutPercentage: input.payload.rolloutPercentage ?? null,
        variant: input.payload.variant ?? null,
        config: (input.payload.config ?? {}) as Prisma.InputJsonValue,
        allowlistUserIds: input.payload.allowlistUserIds as Prisma.InputJsonValue,
        createdByUserId: input.actorUserId,
      }),
    );

    await this.domainEventPublisher.publishSafely(FEATURE_FLAG_EVENTS.UPSERTED, {
      key: flag.key,
      enabled: flag.enabled,
    });

    return { featureFlag: mapFeatureFlag(flag) };
  }
}

@Injectable()
export class EvaluateFeatureFlagService {
  constructor(
    private readonly repository: FeatureFlagRepository,
    private readonly ruleService: FeatureFlagRuleService,
  ) {}

  async execute(input: {
    key: string;
    userId?: string | null;
  }): Promise<FeatureFlagEvaluation> {
    const flag = await this.repository.findByKey(input.key);
    if (!flag) {
      return {
        key: input.key,
        enabled: false,
        variant: null,
        config: {},
      };
    }

    return {
      key: flag.key,
      enabled: this.ruleService.evaluate(flag, { userId: input.userId ?? null }),
      variant: flag.variant,
      config: normalizeJsonObject(flag.config),
    };
  }
}

export function mapFeatureFlag(flag: FeatureFlag): FeatureFlagDto {
  return {
    id: flag.id,
    key: flag.key,
    description: flag.description,
    scope: flag.scope,
    enabled: flag.enabled,
    rolloutPercentage: flag.rolloutPercentage,
    variant: flag.variant,
    config: normalizeJsonObject(flag.config),
    allowlistUserIds: parseStringArray(flag.allowlistUserIds),
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}

function normalizeJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseStringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

