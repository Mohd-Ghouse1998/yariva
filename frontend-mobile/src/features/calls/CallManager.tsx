import { useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { callsApi } from "../../api/endpoints/calls";
import { ApiError } from "../../api/errors";
import { AppState } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { useRealtime } from "../../realtime/RealtimeProvider";
import type { CallSessionDto } from "../../types/call";
import type { PublicProfileDto } from "../../types/profile";
import { shouldSendAcceptedCallOffer } from "./callLogic";
import { isWebRtcAvailable, loadWebRtc } from "./webrtc";

interface RtcConfig {
  iceServers: Array<{ urls: string[]; username?: string; credential?: string }>;
}

interface OutgoingCallParams {
  matchId: string;
  callType: "VOICE" | "VIDEO";
  purpose?: "STANDARD" | "VOICE_INTRODUCTION";
}

interface RtcMediaTrack {
  enabled: boolean;
  stop(): void;
}

export interface RtcMediaStream {
  getTracks(): RtcMediaTrack[];
  getAudioTracks(): RtcMediaTrack[];
  getVideoTracks(): RtcMediaTrack[];
  toURL(): string;
}

interface CallManagerState {
  active: CallSessionDto | null;
  incoming: CallSessionDto | null;
  incomingCaller: PublicProfileDto | null;
  rtcConfig: RtcConfig | null;
  localStream: RtcMediaStream | null;
  remoteStream: RtcMediaStream | null;
}

interface CallManagerActions {
  startOutgoingCall(params: OutgoingCallParams): Promise<void>;
  acceptIncoming(): Promise<void>;
  declineIncoming(): Promise<void>;
  endActive(): Promise<void>;
  setIncoming(call: CallSessionDto | null): void;
}

type CallManagerContextValue = CallManagerState & CallManagerActions;

const CallManagerContext = createContext<CallManagerContextValue | null>(null);

export const useCallManager = (): CallManagerContextValue => {
  const ctx = useContext(CallManagerContext);
  if (!ctx) throw new Error("useCallManager must be used within CallManagerProvider");
  return ctx;
};

export const CallManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { status: authStatus, user } = useAuth();
  const realtime = useRealtime();

  const [state, setState] = useState<CallManagerState>({
    active: null,
    incoming: null,
    incomingCaller: null,
    rtcConfig: null,
    localStream: null,
    remoteStream: null,
  });

  // Hold the live RTCPeerConnection in a ref so it survives state churn.
  const pcRef = useRef<unknown>(null);
  const activeRef = useRef<CallSessionDto | null>(null);
  const rtcConfigRef = useRef<RtcConfig | null>(null);
  const localStreamRef = useRef<RtcMediaStream | null>(null);
  const pendingIce = useRef<unknown[]>([]);
  const offerSentCallIds = useRef(new Set<string>());
  const handledOfferCallIds = useRef(new Set<string>());
  const dismissedCallId = useRef<string | null>(null);

  const teardown = useCallback(() => {
    const pc = pcRef.current as { close?: () => void } | null;
    pc?.close?.();
    pcRef.current = null;
    pendingIce.current = [];
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
    }
    activeRef.current = null;
    rtcConfigRef.current = null;
    localStreamRef.current = null;
    offerSentCallIds.current.clear();
    handledOfferCallIds.current.clear();
    setState({
      active: null,
      incoming: null,
      incomingCaller: null,
      rtcConfig: null,
      localStream: null,
      remoteStream: null,
    });
  }, []);

  const leaveCallRoute = useCallback(
    (callId: string, call?: CallSessionDto) => {
      if (dismissedCallId.current === callId) return;
      dismissedCallId.current = callId;
      if (call?.purpose === "VOICE_INTRODUCTION") {
        router.replace({ pathname: "/(app)/conversation/[conversationId]", params: { conversationId: call.conversationId, helloEnded: "1" } });
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace("/(app)/(tabs)/chats");
    },
    [router],
  );

  const abortCall = useCallback(
    async (callId: string) => {
      const call = activeRef.current;
      await callsApi.end(callId, { reason: "HANGUP" }).catch(() => undefined);
      teardown();
      leaveCallRoute(callId, call ?? undefined);
    },
    [leaveCallRoute, teardown],
  );

  const flushPendingIce = useCallback(
    async (pc: { addIceCandidate: (candidate: unknown) => Promise<void> }) => {
      const candidates = pendingIce.current.splice(0);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          pendingIce.current.push(candidate);
        }
      }
    },
    [],
  );

  const buildPeerConnection = useCallback(
    async (call: CallSessionDto, rtcConfig: RtcConfig) => {
      const rtc = loadWebRtc();
      if (!rtc) {
        throw new Error("Calling isn’t available on this device.");
      }
      const pc = new rtc.RTCPeerConnection({ iceServers: rtcConfig.iceServers as never });
      pcRef.current = pc;

      const constraints: MediaStreamConstraints = {
        audio: true,
        video: call.callType === "VIDEO",
      };
      let local: unknown;
      try {
        local = await rtc.mediaDevices.getUserMedia(constraints);
      } catch {
        (pc as { close?: () => void }).close?.();
        if (pcRef.current === pc) pcRef.current = null;
        throw new Error(
          call.callType === "VIDEO"
            ? "Camera and microphone access are required for video calls."
            : "Microphone access is required for voice calls.",
        );
      }
      const stream = local as RtcMediaStream;
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => {
        (pc as { addTrack: (t: unknown, s: unknown) => unknown }).addTrack(track, local);
      });
      setState((prev) => ({ ...prev, localStream: stream }));

      (pc as { ontrack: ((e: { streams: unknown[] }) => void) | null }).ontrack = (event) => {
        const remote = event.streams[0] as RtcMediaStream | undefined;
        if (!remote) return;
        setState((prev) => ({ ...prev, remoteStream: remote }));
      };
      (
        pc as {
          onicecandidate:
            | ((e: {
                candidate?: {
                  candidate: string;
                  sdpMid: string | null;
                  sdpMLineIndex: number | null;
                };
              }) => void)
            | null;
        }
      ).onicecandidate = (event) => {
        if (event.candidate && event.candidate.sdpMLineIndex !== null) {
          realtime.emit("call.ice", {
            callId: call.id,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
            signalingVersion: call.signalingVersion,
          });
        }
      };
      return pc;
    },
    [realtime],
  );

  const maybeSendAcceptedOffer = useCallback(
    async (call: CallSessionDto) => {
      const pc = pcRef.current as {
        createOffer: (options: unknown) => Promise<{ sdp: string }>;
        setLocalDescription: (description: { sdp: string; type: string }) => Promise<void>;
      } | null;
      const alreadySent = offerSentCallIds.current.has(call.id);
      if (
        !shouldSendAcceptedCallOffer({
          callStatus: call.status,
          initiatorUserId: call.initiatorUserId,
          currentUserId: user?.id,
          peerReady: Boolean(pc),
          offerAlreadySent: alreadySent,
        }) ||
        !pc
      ) {
        return;
      }

      offerSentCallIds.current.add(call.id);
      try {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription({ sdp: offer.sdp, type: "offer" });
        await realtime.socket.emitWithAck("call.offer", {
          callId: call.id,
          sdp: offer.sdp,
          signalingVersion: call.signalingVersion,
        });
      } catch (error) {
        offerSentCallIds.current.delete(call.id);
        throw error;
      }
    },
    [realtime, user?.id],
  );

  const startOutgoingCall = useCallback<CallManagerActions["startOutgoingCall"]>(
    async ({ matchId, callType, purpose }) => {
      if (!isWebRtcAvailable()) {
        throw new Error("Calling isn’t available on this device.");
      }
      const init = await callsApi.initiate({ matchId, callType, purpose });
      dismissedCallId.current = null;
      activeRef.current = init.call;
      rtcConfigRef.current = { iceServers: init.iceServers };
      setState((prev) => ({
        ...prev,
        active: init.call,
        rtcConfig: { iceServers: init.iceServers },
      }));
      router.push("/(call)/active");
      try {
        await buildPeerConnection(init.call, { iceServers: init.iceServers });
        await maybeSendAcceptedOffer(activeRef.current ?? init.call);
      } catch (error) {
        await abortCall(init.call.id);
        throw error;
      }
    },
    [abortCall, buildPeerConnection, maybeSendAcceptedOffer, router],
  );

  const acceptIncoming = useCallback<CallManagerActions["acceptIncoming"]>(async () => {
    const incoming = state.incoming;
    if (!incoming) return;
    if (!isWebRtcAvailable()) {
      throw new Error("Calling isn’t available on this device.");
    }
    const accepted = await callsApi.accept(incoming.id);
    activeRef.current = accepted.call;
    rtcConfigRef.current = { iceServers: accepted.iceServers };
    setState((prev) => ({
      ...prev,
      active: accepted.call,
      incoming: null,
      incomingCaller: null,
      rtcConfig: { iceServers: accepted.iceServers },
    }));
    router.replace("/(call)/active");
    realtime.emit("call.ring.ack", { callId: incoming.id });
    // The peer will send call.offer; we'll handle it in onCallOffer below.
  }, [realtime, router, state.incoming]);

  const declineIncoming = useCallback<CallManagerActions["declineIncoming"]>(async () => {
    const incoming = state.incoming;
    if (!incoming) return;
    await callsApi.decline(incoming.id).catch(() => undefined);
    teardown();
    leaveCallRoute(incoming.id, incoming);
  }, [leaveCallRoute, state.incoming, teardown]);

  const endActive = useCallback<CallManagerActions["endActive"]>(async () => {
    const active = state.active;
    if (active) {
      await callsApi.end(active.id, { reason: "HANGUP" }).catch(() => undefined);
    }
    teardown();
    if (active) leaveCallRoute(active.id, active);
  }, [leaveCallRoute, state.active, teardown]);

  const setIncoming = useCallback((call: CallSessionDto | null) => {
    setState((prev) => ({ ...prev, incoming: call }));
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") teardown();
  }, [authStatus, teardown]);

  const knownCall = state.active ?? state.incoming;
  const knownCallRef = useRef(knownCall);
  knownCallRef.current = knownCall;
  const knownCallId = knownCall?.id;
  useEffect(() => {
    if (authStatus !== "authenticated" || realtime.status !== "connected") return;
    let disposed = false;
    const recover = async () => {
      if (knownCallRef.current) return;
      try {
        const { invitation } = await callsApi.pending();
        if (disposed || !invitation || knownCallRef.current) return;
        dismissedCallId.current = null;
        rtcConfigRef.current = { iceServers: invitation.iceServers };
        setState(previous => ({ ...previous, incoming: invitation.call, incomingCaller: invitation.otherUser, rtcConfig: { iceServers: invitation.iceServers } }));
        router.push("/(call)/incoming");
      } catch { /* A later foreground/reconnect retries without inventing an incoming call. */ }
    };
    void recover();
    const listener = AppState.addEventListener("change", value => { if (value === "active") void recover(); });
    return () => { disposed = true; listener.remove(); };
  }, [authStatus, realtime.status, router]);
  useEffect(() => {
    const knownCall = knownCallRef.current;
    if (!knownCall || authStatus !== "authenticated") return;
    let disposed = false;
    const refresh = async () => {
      try {
        const { call } = await callsApi.get(knownCall.id);
        if (disposed) return;
        if (!["RINGING", "ACCEPTED", "CONNECTING", "CONNECTED"].includes(call.status)) {
          teardown(); leaveCallRoute(call.id, { ...knownCall, ...call });
        } else {
          if (activeRef.current?.id === call.id) activeRef.current = call;
          setState(previous => ({ ...previous, active: previous.active?.id === call.id ? call : previous.active, incoming: previous.incoming?.id === call.id ? call : previous.incoming }));
          await maybeSendAcceptedOffer(call);
        }
      } catch (error) {
        if (!disposed && error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) {
          teardown(); leaveCallRoute(knownCall.id, knownCall);
        }
      }
    };
    void refresh();
    const listener = AppState.addEventListener("change", value => { if (value === "active") void refresh(); });
    const timer = setInterval(() => void refresh(), 15_000);
    return () => { disposed = true; listener.remove(); clearInterval(timer); };
  }, [knownCallId, authStatus, realtime.status, leaveCallRoute, teardown, maybeSendAcceptedOffer]);

  useEffect(() => realtime.onConversationClosed(({ conversationId }) => {
    const call = activeRef.current ?? state.incoming;
    if (call?.conversationId === conversationId) { teardown(); leaveCallRoute(call.id, call); }
  }), [realtime, state.incoming, teardown, leaveCallRoute]);

  // Wire realtime events.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const offRing = realtime.onCallRinging(({ call, otherUser, iceServers }) => {
      if (knownCallRef.current) return;
      dismissedCallId.current = null;
      rtcConfigRef.current = { iceServers };
      setState((prev) => ({
        ...prev,
        incoming: call,
        incomingCaller: otherUser,
        rtcConfig: { iceServers },
      }));
      router.push("/(call)/incoming");
    });
    const offAccepted = realtime.onCallAccepted(({ call }) => {
      activeRef.current = call;
      setState((prev) => ({ ...prev, active: { ...(prev.active ?? call), ...call } }));
      void maybeSendAcceptedOffer(call).catch(() => abortCall(call.id));
    });
    const offAcceptedElsewhere = realtime.onCallAcceptedElsewhere(({ callId }) => {
      teardown();
      leaveCallRoute(callId);
    });
    const offConnected = realtime.onCallConnected(({ call }) => {
      activeRef.current = call;
      setState((prev) => ({ ...prev, active: call }));
    });
    const offEnded = realtime.onCallEnded(({ call }) => {
      const current = knownCallRef.current;
      if (current?.id !== call.id) return;
      teardown();
      leaveCallRoute(call.id, { ...current, ...call });
    });
    const offMissed = realtime.onCallMissed(({ call }) => {
      const current = knownCallRef.current;
      if (current?.id !== call.id) return;
      teardown();
      leaveCallRoute(call.id, { ...current, ...call });
    });

    const offOffer = realtime.socket.on<{ callId: string; sdp: string; signalingVersion: number }>(
      "call.offer",
      async ({ callId, sdp, signalingVersion }) => {
        const active = activeRef.current;
        const rtcConfig = rtcConfigRef.current;
        if (!active || active.id !== callId || !rtcConfig) return;
        if (handledOfferCallIds.current.has(callId)) return;
        handledOfferCallIds.current.add(callId);
        try {
          const current = { ...active, signalingVersion };
          activeRef.current = current;
          const pc = (await buildPeerConnection(current, rtcConfig)) as {
            setRemoteDescription: (desc: { sdp: string; type: string }) => Promise<void>;
            createAnswer: () => Promise<{ sdp: string }>;
            setLocalDescription: (desc: { sdp: string; type: string }) => Promise<void>;
            addIceCandidate: (candidate: unknown) => Promise<void>;
          };
          await pc.setRemoteDescription({ sdp, type: "offer" });
          await flushPendingIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription({ sdp: answer.sdp, type: "answer" });
          await realtime.socket.emitWithAck("call.answer", {
            callId,
            sdp: answer.sdp,
            signalingVersion,
          });
        } catch {
          handledOfferCallIds.current.delete(callId);
          await abortCall(callId);
        }
      },
    );

    const offAnswer = realtime.socket.on<{ callId: string; sdp: string }>(
      "call.answer",
      async ({ callId, sdp }) => {
        const active = activeRef.current;
        const pc = pcRef.current as {
          setRemoteDescription: (d: { sdp: string; type: string }) => Promise<void>;
          addIceCandidate: (candidate: unknown) => Promise<void>;
        } | null;
        if (!active || active.id !== callId || !pc) return;
        await pc.setRemoteDescription({ sdp, type: "answer" });
        await flushPendingIce(pc);
      },
    );

    const offIce = realtime.socket.on<{
      callId: string;
      candidate: {
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number;
      };
    }>("call.ice", async ({ callId, candidate }) => {
      const active = activeRef.current;
      const pc = pcRef.current as { addIceCandidate: (c: unknown) => Promise<void> } | null;
      const rtc = loadWebRtc();
      if (!active || active.id !== callId || !rtc) return;
      const ice = new rtc.RTCIceCandidate(candidate);
      if (!pc) {
        pendingIce.current.push(ice);
        return;
      }
      try {
        await pc.addIceCandidate(ice);
      } catch {
        pendingIce.current.push(ice);
      }
    });

    return () => {
      offRing();
      offAccepted();
      offAcceptedElsewhere();
      offConnected();
      offEnded();
      offMissed();
      offOffer();
      offAnswer();
      offIce();
    };
  }, [
    authStatus,
    abortCall,
    buildPeerConnection,
    flushPendingIce,
    leaveCallRoute,
    maybeSendAcceptedOffer,
    realtime,
    router,
    setIncoming,
    teardown,
  ]);

  const value = useMemo<CallManagerContextValue>(
    () => ({
      ...state,
      startOutgoingCall,
      acceptIncoming,
      declineIncoming,
      endActive,
      setIncoming,
    }),
    [state, startOutgoingCall, acceptIncoming, declineIncoming, endActive, setIncoming],
  );

  return <CallManagerContext.Provider value={value}>{children}</CallManagerContext.Provider>;
};
