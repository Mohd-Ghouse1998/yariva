import { beforeEach, describe, expect, it, vi } from "vitest";

const rawSocket = vi.hoisted(() => {
  const socket = {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    timeout: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn() },
  };
  socket.timeout.mockReturnValue(socket);
  return socket;
});

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => rawSocket),
}));

vi.mock("../utils/env", () => ({
  env: { wsUrl: "http://localhost:3000" },
}));

import { socketClient } from "./socket";

describe("socket acknowledgements", () => {
  beforeEach(() => {
    socketClient.disconnect();
    rawSocket.connected = true;
    rawSocket.emit.mockReset();
    rawSocket.timeout.mockClear();
    rawSocket.timeout.mockReturnValue(rawSocket);
    socketClient.connect({
      accessToken: "test-token",
      sessionId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("adds a request id and resolves a successful backend acknowledgement", async () => {
    rawSocket.emit.mockImplementation((event, body, ack) => {
      ack(null, {
        ok: true,
        requestId: body.requestId,
        serverTime: "2026-09-13T00:00:00.000Z",
      });
    });

    await expect(
      socketClient.emitWithAck("call.offer", {
        callId: "22222222-2222-4222-8222-222222222222",
        sdp: "offer",
        signalingVersion: 1,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(rawSocket.emit).toHaveBeenCalledWith(
      "call.offer",
      expect.objectContaining({ requestId: expect.stringMatching(/^mobile-/) }),
      expect.any(Function),
    );
  });

  it("rejects when the backend rejects a signaling request", async () => {
    rawSocket.emit.mockImplementation((_event, body, ack) => {
      ack(null, {
        ok: false,
        requestId: body.requestId,
        error: {
          code: "CALL_SIGNAL_INVALID",
          message: "Signal rejected",
          requestId: body.requestId,
          details: {},
        },
      });
    });

    await expect(
      socketClient.emitWithAck("call.answer", {
        callId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toThrow("Signal rejected");
  });
});
