import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../app.module";
import { configureHttpServer } from "./http.bootstrap";

export async function bootstrapApplication(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  await configureHttpServer(app);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}
