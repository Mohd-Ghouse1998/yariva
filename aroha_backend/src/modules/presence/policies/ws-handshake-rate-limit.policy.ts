import { Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { RedisService } from "../../../integrations/redis/redis.service";

const WS_HANDSHAKE_LIMIT = 30;
const WS_HANDSHAKE_TTL_SECONDS = 60;

@Injectable()
export class WsHandshakeRateLimitPolicy {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async assertAllowed(socket: Socket): Promise<void> {
    const tracker = resolveSocketTracker(socket);
    const key = `rate-limit:ws-handshake:${tracker}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, WS_HANDSHAKE_TTL_SECONDS);
      }

      if (count > WS_HANDSHAKE_LIMIT) {
        throw new AppException(
          429,
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          "Too many websocket connection attempts",
        );
      }
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.warn(
        `Websocket handshake rate limit check failed for ${tracker}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
}

function resolveSocketTracker(socket: Socket): string {
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0].split(",")[0]?.trim() || "unknown";
  }

  return socket.handshake.address || socket.conn.remoteAddress || "unknown";
}
