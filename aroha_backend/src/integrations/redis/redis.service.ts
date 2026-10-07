import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";

@Injectable()
export class RedisService
  extends IORedis
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    super(configService.getOrThrow<string>("redis.url"), {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.status === "wait" || this.status === "end") {
      await this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
