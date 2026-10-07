import type { CursorPageQuery } from "../../types/discovery";
import type {
  EndMatchResponse,
  MatchDetailDto,
  MatchPageDto,
  UpdateMyMatchCommunicationSettingRequest,
  UpdateMyMatchCommunicationSettingResponse,
} from "../../types/match";
import { http } from "../http";

export const matchesApi = {
  list: (query: CursorPageQuery = {}) =>
    http.get<MatchPageDto>("matches", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  get: (matchId: string) =>
    http
      .get<{ match: MatchDetailDto }>(`matches/${matchId}`)
      .then((response) => response.match),
  end: (matchId: string) => http.delete<EndMatchResponse>(`matches/${matchId}`),
  setMyCommunication: (matchId: string, body: UpdateMyMatchCommunicationSettingRequest) =>
    http.put<UpdateMyMatchCommunicationSettingResponse>(
      `matches/${matchId}/communication-settings/me`,
      body,
    ),
};
