import type { CursorPageQuery, DiscoveryFeedResponseDto } from "../../types/discovery";
import { http } from "../http";

export const discoveryApi = {
  feed: (query: CursorPageQuery = {}) =>
    http.get<DiscoveryFeedResponseDto>("discovery/feed", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
};
