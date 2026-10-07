import type {
  CounterDatePlanRequest,
  CreateDatePlanRequest,
  DatePlanDto,
  DatePlanPageDto,
  DateSafetyStatus,
  VenueCategory,
  VenueLocationMode,
  VenueSuggestionsResponse,
} from "../../types/datePlan";
import type { CursorPageQuery } from "../../types/discovery";
import { http } from "../http";

const unwrap = (response: { datePlan: DatePlanDto }) => response.datePlan;

export const datePlansApi = {
  venueSuggestions: (
    matchId: string,
    query: { query?: string; category?: VenueCategory; locationMode?: VenueLocationMode; area?: string } = {},
  ) =>
    http.get<VenueSuggestionsResponse>(`matches/${matchId}/venue-suggestions`, query),
  create: (matchId: string, body: CreateDatePlanRequest) =>
    http.post<{ datePlan: DatePlanDto }>(`matches/${matchId}/date-plans`, body).then(unwrap),
  listForMatch: (matchId: string, query: CursorPageQuery = {}) =>
    http.get<DatePlanPageDto>(`matches/${matchId}/date-plans`, {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  listMine: (query: CursorPageQuery = {}) =>
    http.get<DatePlanPageDto>("date-plans", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  get: (id: string) => http.get<{ datePlan: DatePlanDto }>(`date-plans/${id}`).then(unwrap),
  accept: (id: string) => http.post<{ datePlan: DatePlanDto }>(`date-plans/${id}/accept`).then(unwrap),
  counter: (id: string, body: CounterDatePlanRequest) =>
    http.post<{ datePlan: DatePlanDto }>(`date-plans/${id}/counter`, body).then(unwrap),
  decline: (id: string) => http.post<{ datePlan: DatePlanDto }>(`date-plans/${id}/decline`).then(unwrap),
  cancel: (id: string) => http.post<{ datePlan: DatePlanDto }>(`date-plans/${id}/cancel`).then(unwrap),
  complete: (id: string) => http.post<{ datePlan: DatePlanDto }>(`date-plans/${id}/complete`).then(unwrap),
  checkIn: (id: string, safetyStatus: DateSafetyStatus) =>
    http.post<{ datePlan: DatePlanDto }>(`date-plans/${id}/check-in`, { safetyStatus }).then(unwrap),
  postDateResponse: (id: string, wantsToMeetAgain: boolean) =>
    http
      .post<{ datePlan: DatePlanDto }>(`date-plans/${id}/post-date-response`, { wantsToMeetAgain })
      .then(unwrap),
};
