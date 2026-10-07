import { Injectable } from "@nestjs/common";
import { AppLogger } from "../logger/app-logger.service";
import { RedisService } from "../../integrations/redis/redis.service";

export interface DomainEventEnvelope<TPayload = Record<string, unknown>> {
  name: string;
  payload: TPayload;
  occurredAt: string;
}

@Injectable()
export class DomainEventPublisher {
  private static readonly CHANNEL = "domain-events";

  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async publish<TPayload>(
    name: string,
    payload: TPayload,
  ): Promise<void> {
    const envelope: DomainEventEnvelope<TPayload> = {
      name,
      payload,
      occurredAt: new Date().toISOString(),
    };

    try {
      await this.redis.publish(
        DomainEventPublisher.CHANNEL,
        JSON.stringify(envelope),
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish domain event ${name}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async publishSafely<TPayload>(
    name: string,
    payload: TPayload,
  ): Promise<boolean> {
    try {
      await this.publish(name, payload);
      return true;
    } catch {
      return false;
    }
  }

  async publishMany(
    events: Array<{
      name: string;
      payload: Record<string, unknown>;
    }>,
  ): Promise<void> {
    for (const event of events) {
      await this.publish(event.name, event.payload);
    }
  }
}
