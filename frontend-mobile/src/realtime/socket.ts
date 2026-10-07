import { io, type Socket } from "socket.io-client";
import { env } from "../utils/env";
import type {
  ClientEvent,
  ServerEvent,
  WsAckPayload,
  WsAckSuccessDto,
  WsHandshakeAuthDto,
} from "../types/realtime";

export type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface SocketClient {
  status: SocketStatus;
  raw: Socket | null;
  connect(auth: WsHandshakeAuthDto): void;
  disconnect(): void;
  emit<T = unknown>(event: ClientEvent, payload: T): void;
  emitWithAck<T = unknown>(
    event: ClientEvent,
    payload: T,
    timeoutMs?: number,
  ): Promise<WsAckSuccessDto>;
  on<T = unknown>(event: ServerEvent, cb: (payload: T) => void): () => void;
  onStatusChange(cb: (status: SocketStatus) => void): () => void;
}

class AppSocketClient implements SocketClient {
  status: SocketStatus = "idle";
  raw: Socket | null = null;
  private statusListeners = new Set<(s: SocketStatus) => void>();
  private requestCounter = 0;

  connect(auth: WsHandshakeAuthDto): void {
    if (this.raw) {
      this.disconnect();
    }
    this.setStatus("connecting");

    const socket = io(`${env.wsUrl}/ws`, {
      transports: ["websocket"],
      auth: auth as unknown as Record<string, unknown>,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      timeout: 10000,
    });

    socket.on("connect", () => this.setStatus("connected"));
    socket.on("disconnect", () => this.setStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => this.setStatus("reconnecting"));
    socket.io.on("reconnect", () => this.setStatus("connected"));

    this.raw = socket;
  }

  disconnect(): void {
    this.raw?.removeAllListeners();
    this.raw?.disconnect();
    this.raw = null;
    this.setStatus("disconnected");
  }

  emit<T>(event: ClientEvent, payload: T): void {
    const body = this.withRequestId(payload);
    this.raw?.emit(event, body);
  }

  emitWithAck<T>(event: ClientEvent, payload: T, timeoutMs = 10_000): Promise<WsAckSuccessDto> {
    const socket = this.raw;
    if (!socket?.connected) {
      return Promise.reject(new Error("Realtime connection is unavailable."));
    }
    const body = this.withRequestId(payload);

    return new Promise((resolve, reject) => {
      socket
        .timeout(timeoutMs)
        .emit(event, body, (timeoutError: Error | null, response?: WsAckPayload) => {
          if (timeoutError) {
            reject(new Error("The call connection timed out."));
            return;
          }
          if (!response) {
            reject(new Error("The call server did not acknowledge the request."));
            return;
          }
          if (!response.ok) {
            reject(new Error(response.error.message || "The call request was rejected."));
            return;
          }
          resolve(response);
        });
    });
  }

  private withRequestId<T>(payload: T): T | (T & { requestId: string }) {
    this.requestCounter += 1;
    const requestId = `mobile-${Date.now()}-${this.requestCounter}`;
    return (
      typeof payload === "object" && payload !== null ? { ...payload, requestId } : payload
    ) as T | (T & { requestId: string });
  }

  on<T>(event: ServerEvent, cb: (payload: T) => void): () => void {
    if (!this.raw) return () => undefined;
    const handler = (payload: T) => cb(payload);
    this.raw.on(event, handler as never);
    return () => this.raw?.off(event, handler as never);
  }

  onStatusChange(cb: (s: SocketStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(s: SocketStatus): void {
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }
}

export const socketClient: SocketClient = new AppSocketClient();
