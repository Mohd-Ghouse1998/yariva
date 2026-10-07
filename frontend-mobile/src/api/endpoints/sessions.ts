import type { CursorPageQuery } from "../../types/discovery";
import type {
  PushTokenDto,
  PushTokenRequest,
  RevokeOtherSessionsResponse,
  SessionPageDto,
} from "../../types/sessions";
import { http } from "../http";

export const sessionsApi = {
  list: (query: CursorPageQuery = {}) =>
    http.get<SessionPageDto>("sessions", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  revokeOthers: () => http.delete<RevokeOtherSessionsResponse>("sessions/others"),
  revoke: (sessionId: string) => http.delete<void>(`sessions/${sessionId}`),
  registerPushToken: (body: PushTokenRequest) => http.post<PushTokenDto>("push-tokens", body),
  removePushToken: (tokenId: string) => http.delete<void>(`push-tokens/${tokenId}`),
};
