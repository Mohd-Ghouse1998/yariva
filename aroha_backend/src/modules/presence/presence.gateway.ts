import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import { AppLogger } from "../../common/logger/app-logger.service";
import { AppException } from "../../common/errors/app.exception";
import { ERROR_CODES } from "../../common/constants/error-codes";
import { buildSocketIoCorsOptions } from "../../config/cors-origin";
import type { AuthContext } from "../../common/types/auth-context.type";
import { AuthContextService } from "../auth/application/auth.services";
import { EmitTypingIndicatorService } from "../messages/application/messages.services";
import {
  ConversationTypingEventDto,
  PresenceHeartbeatDto,
  type WsAckCallback,
  type WsAckErrorDto,
  type WsAckSuccessDto,
  WsHandshakeAuthDto,
  validateWsPayload,
} from "./dto/presence.dto";
import {
  buildWsSystemError,
  ConversationTypingStateService,
  HeartbeatPresenceService,
  RegisterSocketService,
  SocketRegistryService,
  UnregisterSocketService,
} from "./application/presence.services";
import { WsHandshakeRateLimitPolicy } from "./policies/ws-handshake-rate-limit.policy";
import { WsSessionPolicy } from "./policies/ws-session.policy";

interface SocketAuthData {
  authContext: AuthContext;
  connectionId: string;
}

@WebSocketGateway({
  namespace: "/ws",
  cors: buildSocketIoCorsOptions(),
})
export class PresenceGateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  constructor(
    private readonly authContextService: AuthContextService,
    private readonly wsHandshakeRateLimitPolicy: WsHandshakeRateLimitPolicy,
    private readonly wsSessionPolicy: WsSessionPolicy,
    private readonly socketRegistryService: SocketRegistryService,
    private readonly registerSocketService: RegisterSocketService,
    private readonly unregisterSocketService: UnregisterSocketService,
    private readonly heartbeatPresenceService: HeartbeatPresenceService,
    private readonly emitTypingIndicatorService: EmitTypingIndicatorService,
    private readonly conversationTypingStateService: ConversationTypingStateService,
    private readonly logger: AppLogger,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      await this.wsHandshakeRateLimitPolicy.assertAllowed(socket);
      const handshake = await validateWsPayload(
        WsHandshakeAuthDto,
        socket.handshake.auth ?? {},
      );
      const authContext = await this.authContextService.authenticateAccessToken(
        handshake.accessToken,
      );
      this.wsSessionPolicy.assertHandshakeSession(
        authContext,
        handshake.sessionId,
      );
      // lastEventId is accepted for client compatibility; Phase 1 does not
      // define a durable websocket event backlog model to replay from.

      const connectionId = randomUUID();
      socket.data.auth = {
        authContext,
        connectionId,
      } satisfies SocketAuthData;
      this.socketRegistryService.registerLocalSocket(
        connectionId,
        authContext.user.id,
        authContext.session.id,
        socket,
      );

      const ready = await this.registerSocketService.execute({
        connectionId,
        socketId: socket.id,
        authContext,
      });
      socket.emit("system.ready", ready);
    } catch (error) {
      const systemError = buildWsSystemError(error);
      socket.emit("system.error", systemError);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const auth = this.readSocketAuth(socket);
    if (!auth) {
      return;
    }

    this.socketRegistryService.unregisterLocalSocket(auth.connectionId);
    try {
      await this.unregisterSocketService.execute(auth.connectionId);
    } catch (error) {
      this.logger.warn(
        `Failed to unregister socket ${auth.connectionId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  @SubscribeMessage("presence.heartbeat")
  async handleHeartbeat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(PresenceHeartbeatDto, body);

      await this.heartbeatPresenceService.execute({
        connectionId: auth.connectionId,
        sessionId: auth.authContext.session.id,
        status: dto.status,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("conversation.typing.start")
  async handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(ConversationTypingEventDto, body);
      const authorization = await this.emitTypingIndicatorService.execute({
        userId: auth.authContext.user.id,
        conversationId: dto.conversationId,
      });

      await this.conversationTypingStateService.start({
        conversationId: dto.conversationId,
        userId: auth.authContext.user.id,
        connectionId: auth.connectionId,
        recipientUserIds: authorization.recipientUserIds,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("conversation.typing.stop")
  async handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(ConversationTypingEventDto, body);
      const authorization = await this.emitTypingIndicatorService.execute({
        userId: auth.authContext.user.id,
        conversationId: dto.conversationId,
      });

      await this.conversationTypingStateService.stop({
        conversationId: dto.conversationId,
        userId: auth.authContext.user.id,
        connectionId: auth.connectionId,
        recipientUserIds: authorization.recipientUserIds,
      });

      return dto.requestId;
    });
  }

  private async withAck(
    socket: Socket,
    payload: unknown,
    ack: WsAckCallback | undefined,
    handler: (payload: unknown) => Promise<string>,
  ): Promise<void> {
    try {
      const requestId = await handler(payload);
      const response: WsAckSuccessDto = {
        ok: true,
        requestId,
        serverTime: new Date().toISOString(),
      };
      ack?.(response);
    } catch (error) {
      const requestId =
        typeof payload === "object" &&
        payload !== null &&
        "requestId" in payload &&
        typeof (payload as { requestId?: unknown }).requestId === "string"
          ? ((payload as { requestId: string }).requestId)
          : undefined;
      const systemError = buildWsSystemError(error, requestId);
      if (ack) {
        const response: WsAckErrorDto = {
          ok: false,
          requestId: requestId ?? systemError.requestId,
          error: systemError,
        };
        ack(response);
      } else {
        socket.emit("system.error", systemError);
      }
    }
  }

  private requireSocketAuth(socket: Socket): SocketAuthData {
    const auth = this.readSocketAuth(socket);
    if (!auth) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is invalid",
      );
    }

    return auth;
  }

  private readSocketAuth(socket: Socket): SocketAuthData | null {
    if (
      typeof socket.data !== "object" ||
      socket.data === null ||
      !("auth" in socket.data)
    ) {
      return null;
    }

    return socket.data.auth as SocketAuthData;
  }
}
