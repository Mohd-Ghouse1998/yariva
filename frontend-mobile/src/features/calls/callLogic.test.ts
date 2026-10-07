import { describe, expect, it, vi } from "vitest";
import { getRtcStreamUrl, shouldSendAcceptedCallOffer } from "./callLogic";

describe("call signaling decisions", () => {
  const accepted = {
    callStatus: "ACCEPTED" as const,
    initiatorUserId: "caller",
    currentUserId: "caller",
    peerReady: true,
    offerAlreadySent: false,
  };

  it("waits for acceptance before the initiator sends SDP", () => {
    expect(shouldSendAcceptedCallOffer({ ...accepted, callStatus: "RINGING" })).toBe(false);
    expect(shouldSendAcceptedCallOffer(accepted)).toBe(true);
  });

  it("never lets the receiver or a duplicate event create an offer", () => {
    expect(shouldSendAcceptedCallOffer({ ...accepted, currentUserId: "receiver" })).toBe(false);
    expect(shouldSendAcceptedCallOffer({ ...accepted, offerAlreadySent: true })).toBe(false);
  });
});

describe("RTC stream URL", () => {
  it("returns a valid native stream URL", () => {
    expect(getRtcStreamUrl({ toURL: () => "stream-1" })).toBe("stream-1");
  });

  it("fails safely for missing or broken native streams", () => {
    expect(getRtcStreamUrl(null)).toBeNull();
    expect(getRtcStreamUrl({})).toBeNull();
    expect(
      getRtcStreamUrl({
        toURL: vi.fn(() => {
          throw new Error("closed");
        }),
      }),
    ).toBeNull();
  });
});
