import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>("database.url");

    const adapter = new PrismaPg({
      connectionString,
      max: configService.get<number>("database.poolMax", 10),
      connectionTimeoutMillis: configService.get<number>(
        "database.connectionTimeoutMs",
        5_000,
      ),
      idleTimeoutMillis: configService.get<number>(
        "database.idleTimeoutMs",
        300_000,
      ),
      maxLifetimeSeconds: configService.get<number>(
        "database.maxLifetimeSeconds",
        0,
      ),
    });

    super({
      adapter,
      log:
        configService.get<string>("app.nodeEnv") === "development"
          ? ["query", "info", "warn", "error"]
          : ["warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
