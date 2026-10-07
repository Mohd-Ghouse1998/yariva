import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

export interface CachedDuoDiscoveryPage {
  items: Array<{ partyId: string; distanceMeters: number }>;
  nextCursor: string | null;
}

@Injectable()
export class DuoDiscoveryCache {
  private static readonly GENERATION_KEY = "duo-discovery:generation";

  constructor(private readonly redis: RedisService) {}

  async generation(): Promise<string> {
    return (await this.redis.get(DuoDiscoveryCache.GENERATION_KEY)) ?? "0";
  }

  async bump(): Promise<void> {
    await this.redis.incr(DuoDiscoveryCache.GENERATION_KEY);
  }

  async get(key: string): Promise<CachedDuoDiscoveryPage | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedDuoDiscoveryPage;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  async set(
    key: string,
    value: CachedDuoDiscoveryPage,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  key(input: {
    viewerId: string;
    partyId: string;
    membershipVersion: number;
    sceneFingerprint: string;
    generation: string;
    cursor: string | null;
    limit: number;
  }): string {
    return [
      "duo-discovery:feed:v1",
      input.viewerId,
      input.partyId,
      input.membershipVersion,
      input.sceneFingerprint,
      input.generation,
      input.cursor ?? "start",
      input.limit,
    ].join(":");
  }
}
