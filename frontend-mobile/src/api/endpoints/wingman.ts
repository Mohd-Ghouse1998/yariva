import type {
  DuoDiscoveryPageDto,
  DuoVoteResponseDto,
  WingmanCapabilitiesDto,
  WingmanStateDto,
} from "../../types/wingman";
import { http } from "../http";

export const wingmanApi = {
  capabilities: () => http.get<WingmanCapabilitiesDto>("wingman/capabilities"),
  mine: () => http.get<WingmanStateDto>("wingman/me"),
  invite: (identifier: string) =>
    http.post<WingmanStateDto & { deepLink: string }>("wingman/invitations", { identifier }),
  accept: (token?: string) =>
    http.post<WingmanStateDto>("wingman/invitations/accept", token ? { token } : {}),
  decline: (token?: string) =>
    http.post<WingmanStateDto>("wingman/invitations/decline", token ? { token } : {}),
  cancel: (invitationId: string) =>
    http.post<WingmanStateDto>(`wingman/invitations/${invitationId}/cancel`),
  leave: (partyId: string) => http.post<WingmanStateDto>(`wingman/parties/${partyId}/leave`),
  consentScene: (partyId: string, sceneId: string, sceneVersion: number) =>
    http.post<WingmanStateDto>(`wingman/parties/${partyId}/scene-consent`, {
      sceneId,
      sceneVersion,
    }),
  discover: (cursor?: string, limit = 10) =>
    http.get<DuoDiscoveryPageDto>("wingman/discovery", {
      ...(cursor ? { cursor } : {}),
      limit,
    }),
  vote: (targetPartyId: string, decision: "APPROVE" | "PASS") =>
    http.post<DuoVoteResponseDto>(`wingman/discovery/${targetPartyId}/vote`, { decision }),
};
