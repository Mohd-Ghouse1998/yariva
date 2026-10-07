import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

const CONNECTION_TTL_SECONDS = 75;

export interface SocketConnectionRecord {
  connectionId: string;
  socketId: string;
  userId: string;
  sessionId: string;
  connectedAt: string;
  lastHeartbeatAt: string;
}

@Injectable()
export class SocketRegistryRepository {
  constructor(private readonly redis: RedisService) {}

  async register(input: SocketConnectionRecord): Promise<void> {
    await this.redis
      .multi()
      .set(
        this.connectionKey(input.connectionId),
        JSON.stringify(input),
        "EX",
        CONNECTION_TTL_SECONDS,
      )
      .sadd(this.userSetKey(input.userId), input.connectionId)
      .sadd(this.sessionSetKey(input.sessionId), input.connectionId)
      .exec();
  }

  async refreshHeartbeat(
    connectionId: string,
    heartbeatAt: string,
  ): Promise<SocketConnectionRecord | null> {
    const existing = await this.get(connectionId);
    if (!existing) {
      return null;
    }

    const updated: SocketConnectionRecord = {
      ...existing,
      lastHeartbeatAt: heartbeatAt,
    };
    await this.redis.set(
      this.connectionKey(connectionId),
      JSON.stringify(updated),
      "EX",
      CONNECTION_TTL_SECONDS,
    );

    return updated;
  }

  async get(connectionId: string): Promise<SocketConnectionRecord | null> {
    const raw = await this.redis.get(this.connectionKey(connectionId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SocketConnectionRecord;
  }

  async unregister(connectionId: string): Promise<SocketConnectionRecord | null> {
    const existing = await this.get(connectionId);
    if (!existing) {
      return null;
    }

    await this.redis
      .multi()
      .del(this.connectionKey(connectionId))
      .srem(this.userSetKey(existing.userId), connectionId)
      .srem(this.sessionSetKey(existing.sessionId), connectionId)
      .exec();

    return existing;
  }

  async countActiveConnectionsForUser(userId: string): Promise<number> {
    return this.cleanupAndCountSet(this.userSetKey(userId));
  }

  async countActiveConnectionsForSession(sessionId: string): Promise<number> {
    return this.cleanupAndCountSet(this.sessionSetKey(sessionId));
  }

  private async cleanupAndCountSet(key: string): Promise<number> {
    const connectionIds = await this.redis.smembers(key);
    if (connectionIds.length === 0) {
      return 0;
    }

    const pipeline = this.redis.pipeline();
    for (const connectionId of connectionIds) {
      pipeline.exists(this.connectionKey(connectionId));
    }
    const results = await pipeline.exec();
    if (!results) {
      return 0;
    }

    const staleIds: string[] = [];
    let activeCount = 0;
    for (const [index, result] of results.entries()) {
      const value = result[1];
      if (value === 1) {
        activeCount += 1;
      } else {
        staleIds.push(connectionIds[index]!);
      }
    }

    if (staleIds.length > 0) {
      await this.redis.srem(key, ...staleIds);
    }

    return activeCount;
  }

  private connectionKey(connectionId: string): string {
    return `ws:connection:${connectionId}`;
  }

  private userSetKey(userId: string): string {
    return `ws:user:${userId}:connections`;
  }

  private sessionSetKey(sessionId: string): string {
    return `ws:session:${sessionId}:connections`;
  }
}
