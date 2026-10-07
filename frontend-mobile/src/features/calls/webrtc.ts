// Wrapper around react-native-webrtc that provides graceful no-op behavior
// when running in Expo Go (where the native module isn't available).
//
// IMPORTANT: Voice / video calling requires an Expo development build or a
// native build of the app. Expo Go does not bundle react-native-webrtc.

import Constants from "expo-constants";
import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export interface RtcViewProps {
  streamURL?: string;
  mirror?: boolean;
  objectFit?: "contain" | "cover";
  zOrder?: number;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  style?: StyleProp<ViewStyle>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type WebRTCModule = {
  RTCPeerConnection: new (config: RTCConfiguration) => any;
  RTCIceCandidate: new (init: RTCIceCandidateInit) => any;
  RTCSessionDescription: new (init: RTCSessionDescriptionInit) => any;
  mediaDevices: {
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<any>;
  };
  RTCView: ComponentType<RtcViewProps>;
};

let cached: WebRTCModule | null | undefined;

function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

export function loadWebRtc(): WebRTCModule | null {
  if (cached !== undefined) return cached;
  if (isExpoGo()) {
    cached = null;
    return cached;
  }

  try {
    // Use require so the import doesn't crash bundling on web/Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-webrtc");
    cached = {
      RTCPeerConnection: mod.RTCPeerConnection,
      RTCIceCandidate: mod.RTCIceCandidate,
      RTCSessionDescription: mod.RTCSessionDescription,
      mediaDevices: mod.mediaDevices,
      RTCView: mod.RTCView,
    };
  } catch {
    cached = null;
  }
  return cached;
}

export function isWebRtcAvailable(): boolean {
  return loadWebRtc() !== null;
}

export function getRtcView(): ComponentType<RtcViewProps> | null {
  return loadWebRtc()?.RTCView ?? null;
}
