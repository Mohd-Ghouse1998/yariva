import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../integrations/redis/redis.service";

const TYPING_TTL_SECONDS = 6;

@Injectable()
export class TypingStateRepository {
  constructor(private readonly redis: RedisService) {}

  async startTyping(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
    recipientUserIds: string[];
  }): Promise<void> {
    const entry = this.connectionConversationKey(
      input.conversationId,
      input.userId,
      input.connectionId,
    );

    await this.redis
      .multi()
      .set(entry, "1", "EX", TYPING_TTL_SECONDS)
      .set(
        this.recipientIndexKey(
          input.conversationId,
          input.userId,
          input.connectionId,
        ),
        JSON.stringify(input.recipientUserIds),
        "EX",
        TYPING_TTL_SECONDS,
      )
      .sadd(this.conversationUserSetKey(input.conversationId, input.userId), input.connectionId)
      .sadd(this.connectionIndexKey(input.connectionId), `${input.conversationId}:${input.userId}`)
      .expire(this.connectionIndexKey(input.connectionId), TYPING_TTL_SECONDS)
      .exec();
  }

  async stopTyping(input: {
    conversationId: string;
    userId: string;
    connectionId: string;
  }): Promise<void> {
    await this.redis
      .multi()
      .del(
        this.connectionConversationKey(
          input.conversationId,
          input.userId,
          input.connectionId,
        ),
      )
      .del(
        this.recipientIndexKey(
          input.conversationId,
          input.userId,
          input.connectionId,
        ),
      )
      .srem(this.conversationUserSetKey(input.conversationId, input.userId), input.connectionId)
      .srem(this.connectionIndexKey(input.connectionId), `${input.conversationId}:${input.userId}`)
      .exec();
  }

  async clearConnection(connectionId: string): Promise<Array<{
    conversationId: string;
    userId: string;
    recipientUserIds: string[];
  }>> {
    const entries = await this.redis.smembers(this.connectionIndexKey(connectionId));
    if (entries.length === 0) {
      return [];
    }

    const typedEntries = entries.flatMap((entry) => {
      const [conversationId, userId] = entry.split(":");
      if (!conversationId || !userId) {
        return [];
      }

      return [{ conversationId, userId }];
    });

    const recipientPipeline = this.redis.pipeline();
    for (const entry of typedEntries) {
      recipientPipeline.get(
        this.recipientIndexKey(
          entry.conversationId,
          entry.userId,
          connectionId,
        ),
      );
    }
    const recipientResults = await recipientPipeline.exec();

    const pipeline = this.redis.multi();
    for (const entry of typedEntries) {
      pipeline.del(
        this.connectionConversationKey(
          entry.conversationId,
          entry.userId,
          connectionId,
        ),
      );
      pipeline.del(
        this.recipientIndexKey(
          entry.conversationId,
          entry.userId,
          connectionId,
        ),
      );
      pipeline.srem(
        this.conversationUserSetKey(entry.conversationId, entry.userId),
        connectionId,
      );
    }
    pipeline.del(this.connectionIndexKey(connectionId));
    await pipeline.exec();

    return typedEntries.map((entry, index) => ({
      ...entry,
      recipientUserIds: parseRecipientUserIds(recipientResults?.[index]?.[1] ?? null),
    }));
  }

  async countTypingConnections(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const setKey = this.conversationUserSetKey(conversationId, userId);
    const connectionIds = await this.redis.smembers(setKey);
    if (connectionIds.length === 0) {
      return 0;
    }

    const pipeline = this.redis.pipeline();
    for (const connectionId of connectionIds) {
      pipeline.exists(
        this.connectionConversationKey(conversationId, userId, connectionId),
      );
    }
    const results = await pipeline.exec();
    if (!results) {
      return 0;
    }

    const staleIds: string[] = [];
    let activeCount = 0;
    for (const [index, result] of results.entries()) {
      const exists = result[1];
      if (exists === 1) {
        activeCount += 1;
      } else {
        staleIds.push(connectionIds[index]!);
      }
    }

    if (staleIds.length > 0) {
      await this.redis.srem(setKey, ...staleIds);
    }

    return activeCount;
  }

  getExpiresAt(): string {
    return new Date(Date.now() + TYPING_TTL_SECONDS * 1000).toISOString();
  }

  private conversationUserSetKey(conversationId: string, userId: string): string {
    return `typing:conversation:${conversationId}:user:${userId}:connections`;
  }

  private connectionConversationKey(
    conversationId: string,
    userId: string,
    connectionId: string,
  ): string {
    return `typing:conversation:${conversationId}:user:${userId}:connection:${connectionId}`;
  }

  private connectionIndexKey(connectionId: string): string {
    return `typing:connection:${connectionId}:entries`;
  }

  private recipientIndexKey(
    conversationId: string,
    userId: string,
    connectionId: string,
  ): string {
    return `typing:conversation:${conversationId}:user:${userId}:connection:${connectionId}:recipients`;
  }
}

function parseRecipientUserIds(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
