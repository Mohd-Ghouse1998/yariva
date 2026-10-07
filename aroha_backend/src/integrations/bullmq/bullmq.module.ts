import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { BullmqProducer } from "./bullmq.producer";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.getOrThrow<string>("redis.url"));

        return {
          prefix: configService.get<string>("bullmq.prefix", "aroha"),
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
            db:
              redisUrl.pathname && redisUrl.pathname !== "/"
                ? Number(redisUrl.pathname.slice(1))
                : 0,
            tls: redisUrl.protocol === "rediss:" ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: "default",
    }),
  ],
  providers: [BullmqProducer],
  exports: [BullModule, BullmqProducer],
})
export class BullmqModule {}
