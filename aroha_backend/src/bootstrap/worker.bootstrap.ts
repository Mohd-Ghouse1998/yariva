import { NestFactory } from "@nestjs/core";
import { AppLogger } from "../common/logger/app-logger.service";
import { JobsModule } from "../jobs/jobs.module";

export async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(JobsModule, {
    bufferLogs: true,
  });
  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  logger.log("Aroha worker started");
}

