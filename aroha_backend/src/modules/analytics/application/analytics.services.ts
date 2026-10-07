import { Injectable } from "@nestjs/common";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import { AppLogger } from "../../../common/logger/app-logger.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import type { Prisma } from "../../../generated/prisma/client";
import { ANALYTICS_EVENTS } from "../events/analytics.events";
import type {
  AnalyticsSummaryDto,
  IngestAnalyticsEventsDto,
  IngestAnalyticsEventsResponseDto,
} from "../dto/analytics.dto";
import {
  AnalyticsEventRepository,
  AnalyticsSummaryRepository,
} from "../infrastructure/analytics.infrastructure";

@Injectable()
export class IngestAnalyticsEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: AnalyticsEventRepository,
    private readonly bullmqProducer: BullmqProducer,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly logger: AppLogger,
  ) {}

  async execute(input: {
    actor: AuthContext;
    payload: IngestAnalyticsEventsDto;
  }): Promise<IngestAnalyticsEventsResponseDto> {
    const acceptedCount = await this.prisma.$transaction((tx) =>
      this.repository.createMany(
        tx,
        input.payload.events.map((event) => ({
          userId: input.actor.user.id,
          sessionId: input.actor.session.id,
          eventName: event.eventName,
          source: event.source,
          occurredAt: new Date(event.occurredAt),
          properties: {
            ...(event.properties ?? {}),
            clientEventId: event.clientEventId ?? null,
          } as Prisma.InputJsonValue,
        })),
      ),
    );

    await this.domainEventPublisher.publishSafely(ANALYTICS_EVENTS.INGESTED, {
      userId: input.actor.user.id,
      acceptedCount,
    });

    try {
      await this.bullmqProducer.enqueue(
        "analytics.rollup",
        { windows: ["24h", "7d", "30d"] },
        { jobId: `analytics.rollup:${new Date().toISOString().slice(0, 13)}` },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue analytics rollup: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }

    return { acceptedCount };
  }
}

@Injectable()
export class AnalyticsEventWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: AnalyticsEventRepository,
  ) {}

  async write(input: {
    userId?: string | null;
    sessionId?: string | null;
    eventName: string;
    source?: "MOBILE" | "SYSTEM" | "ADMIN";
    properties?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.repository.createMany(tx, [
        {
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          eventName: input.eventName,
          source: input.source ?? "SYSTEM",
          properties: (input.properties ?? {}) as Prisma.InputJsonValue,
          occurredAt: input.occurredAt ?? new Date(),
        },
      ]),
    );
  }
}

@Injectable()
export class AnalyticsSummaryService {
  constructor(private readonly repository: AnalyticsSummaryRepository) {}

  async execute(window: "24h" | "7d" | "30d"): Promise<AnalyticsSummaryDto> {
    return this.repository.summarize(window);
  }
}
