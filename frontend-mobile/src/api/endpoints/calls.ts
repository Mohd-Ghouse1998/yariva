import type {
  AcceptCallResponse,
  CallResponse,
  EndCallRequest,
  InitiateCallRequest,
  InitiateCallResponse,
} from "../../types/call";
import { http } from "../http";
import type { PublicProfileDto } from "../../types/profile";

export const callsApi = {
  get: (callId: string) => http.get<CallResponse>(`calls/${callId}`),
  pending: () => http.get<{ invitation: (InitiateCallResponse & { otherUser: PublicProfileDto }) | null }>("calls/pending"),
  capabilities: () => http.get<{ voiceIntroductionsEnabled: boolean }>("calls/capabilities"),
  initiate: (body: InitiateCallRequest) => http.post<InitiateCallResponse>("calls", body),
  accept: (callId: string) => http.post<AcceptCallResponse>(`calls/${callId}/accept`, {}),
  decline: (callId: string) => http.post<CallResponse>(`calls/${callId}/decline`, {}),
  end: (callId: string, body: EndCallRequest) =>
    http.post<CallResponse>(`calls/${callId}/end`, body),
};
