import type { CallSessionStatus } from "../../types/enums";

interface OfferDecisionInput {
  callStatus: CallSessionStatus;
  initiatorUserId: string;
  currentUserId: string | null | undefined;
  peerReady: boolean;
  offerAlreadySent: boolean;
}

/**
 * The receiver must accept before the initiator publishes SDP. Publishing while
 * the call is still ringing can race the receiver's active-call state and lose
 * both the offer and the first ICE candidates.
 */
export const shouldSendAcceptedCallOffer = ({
  callStatus,
  initiatorUserId,
  currentUserId,
  peerReady,
  offerAlreadySent,
}: OfferDecisionInput): boolean =>
  initiatorUserId === currentUserId &&
  (callStatus === "ACCEPTED" || callStatus === "CONNECTING") &&
  peerReady &&
  !offerAlreadySent;

/** Safely obtains the native WebRTC stream URL used by RTCView. */
export const getRtcStreamUrl = (stream: unknown): string | null => {
  if (!stream || typeof stream !== "object" || !("toURL" in stream)) return null;
  const toURL = (stream as { toURL?: unknown }).toURL;
  if (typeof toURL !== "function") return null;

  try {
    const value = toURL.call(stream);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
};
