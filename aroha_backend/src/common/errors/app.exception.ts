import { HttpException } from "@nestjs/common";
import type { ErrorCode } from "../constants/error-codes";

export class AppException extends HttpException {
  public readonly code: ErrorCode;

  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code,
        message,
        details: details ?? {},
      },
      status,
    );
    this.code = code;
    this.details = details;
  }
}
