import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { ERROR_CODES } from "../constants/error-codes";
import { AppException } from "../errors/app.exception";
import { AppLogger } from "../logger/app-logger.service";
import type { AuthenticatedRequest } from "../types/auth-context.type";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? "unknown";

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: this.readMessage(exception),
          requestId,
          details: exception.details ?? {},
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const details =
        typeof payload === "object" && payload !== null ? payload : {};
      const message = this.readHttpMessage(payload);

      response.status(status).json({
        error: {
          code:
            status === HttpStatus.BAD_REQUEST
              ? ERROR_CODES.VALIDATION_FAILED
              : status === HttpStatus.UNAUTHORIZED
                ? ERROR_CODES.UNAUTHORIZED
                : status === HttpStatus.FORBIDDEN
                  ? ERROR_CODES.FORBIDDEN
                  : status === HttpStatus.NOT_FOUND
                    ? ERROR_CODES.RESOURCE_NOT_FOUND
                    : ERROR_CODES.INTERNAL_ERROR,
          message,
          requestId,
          details,
        },
      });
      return;
    }

    this.logger.error(
      `Unhandled exception for request ${requestId}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: "Unexpected server error",
        requestId,
        details: {},
      },
    });
  }

  private readMessage(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return response;
    }
    if (
      typeof response === "object" &&
      response !== null &&
      "message" in response &&
      typeof response.message === "string"
    ) {
      return response.message;
    }

    return "Request failed";
  }

  private readHttpMessage(payload: string | object): string {
    if (typeof payload === "string") {
      return payload;
    }
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload
    ) {
      const message = payload.message;
      if (Array.isArray(message)) {
        return message.join(", ");
      }
      if (typeof message === "string") {
        return message;
      }
    }

    return "Request failed";
  }
}
