import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { AppException } from "../../common/errors/app.exception";
import { ERROR_CODES } from "../../common/constants/error-codes";
import { buildSocketIoCorsOptions } from "../../config/cors-origin";
import type { AuthContext } from "../../common/types/auth-context.type";
import type {
  WsAckCallback,
  WsAckErrorDto,
  WsAckSuccessDto,
} from "../presence/dto/presence.dto";
import {
  validateWsPayload,
} from "../presence/dto/presence.dto";
import { buildWsSystemError } from "../presence/application/presence.services";
import { RelaySignalService } from "./application/calls.services";
import {
  CallAnswerWsDto,
  CallIceWsDto,
  CallOfferWsDto,
  CallRingAckWsDto,
} from "./dto/calls.dto";

interface SocketAuthData {
  authContext: AuthContext;
  connectionId: string;
}

@WebSocketGateway({
  namespace: "/ws",
  cors: buildSocketIoCorsOptions(),
})
export class CallsGateway {
  constructor(private readonly relaySignalService: RelaySignalService) {}

  @SubscribeMessage("call.ring.ack")
  async handleRingAck(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(CallRingAckWsDto, body);

      await this.relaySignalService.recordRingAck({
        callId: dto.callId,
        userId: auth.authContext.user.id,
        sessionId: auth.authContext.session.id,
        connectionId: auth.connectionId,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("call.offer")
  async handleOffer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(CallOfferWsDto, body);

      await this.relaySignalService.relayOffer({
        callId: dto.callId,
        userId: auth.authContext.user.id,
        sessionId: auth.authContext.session.id,
        signalingVersion: dto.signalingVersion,
        sdp: dto.sdp,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("call.answer")
  async handleAnswer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(CallAnswerWsDto, body);

      await this.relaySignalService.relayAnswer({
        callId: dto.callId,
        userId: auth.authContext.user.id,
        sessionId: auth.authContext.session.id,
        signalingVersion: dto.signalingVersion,
        sdp: dto.sdp,
      });

      return dto.requestId;
    });
  }

  @SubscribeMessage("call.ice")
  async handleIce(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
    ack?: WsAckCallback,
  ): Promise<void> {
    await this.withAck(socket, payload, ack, async (body) => {
      const auth = this.requireSocketAuth(socket);
      const dto = await validateWsPayload(CallIceWsDto, body);

      await this.relaySignalService.relayIce({
        callId: dto.callId,
        userId: auth.authContext.user.id,
        sessionId: auth.authContext.session.id,
        signalingVersion: dto.signalingVersion,
        candidate: {
          candidate: dto.candidate.candidate,
          sdpMid: dto.candidate.sdpMid ?? null,
          sdpMLineIndex: dto.candidate.sdpMLineIndex,
          usernameFragment: dto.candidate.usernameFragment ?? null,
        },
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
    if (
      typeof socket.data !== "object" ||
      socket.data === null ||
      !("auth" in socket.data)
    ) {
      throw new AppException(
        401,
        ERROR_CODES.SESSION_INVALID,
        "Socket session is invalid",
      );
    }

    return socket.data.auth as SocketAuthData;
  }
}
