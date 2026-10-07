import { http } from "../http";
import type { DatePlanStatus, VenueSuggestionsResponse } from "../../types/datePlan";
import { datePlansApi } from "./datePlans";

export interface DuoPlan {
  id: string;
  conversationId: string;
  status: DatePlanStatus;
  version: number;
  activity: string;
  venueName: string;
  publicLocality: string;
  startAt: string;
  acceptedUserIds: string[];
  participantCount: number;
}
export interface DuoProposal {
  requestId: string;
  activity: string;
  venueName: string;
  publicLocality: string;
  startAt: string;
}
export const duoPlansApi = {
  list: (conversationId: string) => http.get<{ items: DuoPlan[] }>(`wingman/conversations/${conversationId}/plans`),
  venues: (conversationId: string, query: Parameters<typeof datePlansApi.venueSuggestions>[1]) => http.get<VenueSuggestionsResponse>(`wingman/conversations/${conversationId}/venues`, query),
  create: (conversationId: string, proposal: DuoProposal) => http.post<DuoPlan>(`wingman/conversations/${conversationId}/plans`, proposal),
  respond: (planId: string, expectedVersion: number, action: "ACCEPT" | "DECLINE" | "CANCEL") => http.post<DuoPlan>(`wingman/plans/${planId}/respond`, { expectedVersion, action }),
  counter: (planId: string, proposal: DuoProposal & { expectedVersion: number }) => http.post<DuoPlan>(`wingman/plans/${planId}/counter`, proposal),
};
