import { http } from "../http";
import type { BlindEvent, BlindPerson, BlindPolicy } from "../../types/blind";
export const blindApi = {
  capabilities: () => http.get<{ enabled: boolean }>("blind/capabilities"),
  event: (id = "current") => http.get<BlindEvent>(`blind/events/${id}`),
  join: (id: string, intent: "DATING" | "FRIENDSHIP", notificationsEnabled: boolean) => http.post<BlindEvent>(`blind/events/${id}/join`, { intent, notificationsEnabled, blindConsent: true }),
  leave: (id: string) => http.post<BlindEvent>(`blind/events/${id}/leave`),
  people: (id: string) => http.get<{ items: BlindPerson[] }>(`blind/events/${id}/people`),
  interest: (id: string, target: string) => http.post<{ state: "WAITING" | "MATCHED"; conversationId: string | null }>(`blind/events/${id}/interest/${target}`),
  relationship: (matchId: string) => http.get<{ blind: BlindPolicy | null }>(`blind/relationships/${matchId}`),
  reveal: (matchId: string) => http.post<{ blind: BlindPolicy }>(`blind/relationships/${matchId}/reveal`),
};
