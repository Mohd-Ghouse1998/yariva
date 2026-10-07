import type { CursorPageQuery } from "../../types/discovery";
import type {
  BlockPageDto,
  BlockedUserDto,
  CreateBlockRequest,
  CreateReportRequest,
  CreateReportResponse,
  ReportPageDto,
} from "../../types/safety";
import { http } from "../http";

export const safetyApi = {
  block: (body: CreateBlockRequest) =>
    http
      .post<{ block: BlockedUserDto }>("blocks", body)
      .then((response) => response.block),
  unblock: (blockedUserId: string) => http.delete<void>(`blocks/${blockedUserId}`),
  blocks: (query: CursorPageQuery = {}) =>
    http.get<BlockPageDto>("blocks", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  report: (body: CreateReportRequest) =>
    http.post<CreateReportResponse>("reports", body),
  myReports: (query: CursorPageQuery = {}) =>
    http.get<ReportPageDto>("reports/me", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
};
