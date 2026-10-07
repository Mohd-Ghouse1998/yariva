import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validate,
} from "class-validator";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

export class WsHandshakeAuthDto {
  @IsString()
  @IsNotEmpty()
  readonly accessToken!: string;

  @IsUUID("4")
  readonly sessionId!: string;

  @IsOptional()
  @IsString()
  readonly lastEventId?: string | null;
}

export class PresenceHeartbeatDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsIn(["ONLINE"])
  readonly status!: "ONLINE";
}

export class ConversationTypingEventDto {
  @IsString()
  @IsNotEmpty()
  readonly requestId!: string;

  @IsUUID("4")
  readonly conversationId!: string;
}

export interface WsReadyDto {
  connectionId: string;
  userId: string;
  sessionId: string;
  serverTime: string;
}

export interface WsAckSuccessDto {
  ok: true;
  requestId: string;
  serverTime: string;
}

export interface WsAckErrorDto {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
}

export interface WsSystemErrorDto {
  code: string;
  message: string;
  requestId: string;
  details: Record<string, unknown>;
}

export interface PresenceUpdatedEventDto {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  updatedAt: string;
}

export interface ConversationTypingUpdatedEventDto {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  expiresAt: string;
}

export type WsAckPayload = WsAckSuccessDto | WsAckErrorDto;
export type WsAckCallback = (payload: WsAckPayload) => void;

export async function validateWsPayload<TPayload extends object>(
  cls: new () => TPayload,
  value: unknown,
): Promise<TPayload> {
  const instance = plainToInstance(cls, value);
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new AppException(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Invalid websocket payload",
      {
        validationErrors: errors.map((error) => ({
          property: error.property,
          constraints: error.constraints ?? {},
        })),
      },
    );
  }

  return instance;
}
