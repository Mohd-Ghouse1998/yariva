import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type IORedis from "ioredis";
import { AppLogger } from "../../../common/logger/app-logger.service";
import type { DomainEventEnvelope } from "../../../common/services/domain-event.publisher";
import { RedisService } from "../../../integrations/redis/redis.service";
import { PresenceRealtimeFanoutService } from "../application/presence.services";

@Injectable()
export class PresenceDomainEventSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private subscriber: IORedis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly fanoutService: PresenceRealtimeFanoutService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    await this.subscriber.connect();
    await this.subscriber.subscribe("domain-events");
    this.subscriber.on("message", async (channel, payload) => {
      if (channel !== "domain-events") {
        return;
      }

      try {
        const envelope = JSON.parse(payload) as DomainEventEnvelope;
        await this.fanoutService.fanoutDomainEvent({
          name: envelope.name,
          payload:
            typeof envelope.payload === "object" && envelope.payload !== null
              ? (envelope.payload as Record<string, unknown>)
              : {},
        });
      } catch (error) {
        this.logger.warn(
          `Failed to process realtime domain event: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    await this.subscriber.unsubscribe("domain-events");
    await this.subscriber.quit();
    this.subscriber = null;
  }
}
