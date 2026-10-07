import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

const PRESENCE_TTL_SECONDS = 60;

export interface PresenceSnapshot {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  updatedAt: string;
}

@Injectable()
export class PresenceRepository {
  constructor(private readonly redis: RedisService) {}

  async markOnline(userId: string, updatedAt: string): Promise<void> {
    await this.redis
      .multi()
      .hset(this.userKey(userId), {
        status: "ONLINE",
        updatedAt,
      })
      .expire(this.userKey(userId), PRESENCE_TTL_SECONDS)
      .exec();
  }

  async markOffline(userId: string, updatedAt: string): Promise<void> {
    await this.redis
      .multi()
      .hset(this.userKey(userId), {
        status: "OFFLINE",
        updatedAt,
      })
      .expire(this.userKey(userId), PRESENCE_TTL_SECONDS)
      .exec();
  }

  async get(userId: string): Promise<PresenceSnapshot | null> {
    const result = await this.redis.hgetall(this.userKey(userId));
    if (!result.status || !result.updatedAt) {
      return null;
    }

    return {
      userId,
      status: result.status === "ONLINE" ? "ONLINE" : "OFFLINE",
      updatedAt: result.updatedAt,
    };
  }

  private userKey(userId: string): string {
    return `presence:user:${userId}`;
  }
}
