import type { InterestCatalogQuery, InterestTagPageDto } from "../../types/profile";
import { http } from "../http";

export const interestsApi = {
  catalog: (query: InterestCatalogQuery = {}) =>
    http.get<InterestTagPageDto>("interests", {
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
    }),
};
