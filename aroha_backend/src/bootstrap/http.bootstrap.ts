import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { AppLogger } from "../common/logger/app-logger.service";
import { buildHttpCorsOptions } from "../config/cors-origin";

export async function configureHttpServer(
  app: NestExpressApplication,
): Promise<void> {
  const configService = app.get(ConfigService);
  const logger = app.get(AppLogger);
  const apiPrefix = configService.get<string>("app.apiPrefix", "api/v1");

  app.useLogger(logger);
  app.use(helmet());
  app.enableCors(buildHttpCorsOptions());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const headerRequestId = req.header("x-request-id");
    const requestId =
      headerRequestId && headerRequestId.trim().length > 0
        ? headerRequestId.trim()
        : randomUUID();

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.log(
        JSON.stringify({
          event: "http.request",
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          userAgent: req.get("user-agent") ?? null,
          remoteAddress: req.ip ?? null,
        }),
      );
    });
    next();
  });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.enableShutdownHooks();
}
