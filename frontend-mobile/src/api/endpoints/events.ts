import type { EventListingDto, EventPageDto, EventQuery } from "../../types/events";
import { http } from "../http";

export const eventsApi = {
  status: () => http.get<{ enabled: boolean }>("events/status"),
  list: (query: EventQuery) => http.get<EventPageDto>("events", { ...query }),
  get: (id: string) => http.get<{ event: EventListingDto }>(`events/${id}`).then((r) => r.event),
  save: (id: string) => http.post<{ event: EventListingDto }>(`events/${id}/save`).then((r) => r.event),
  unsave: (id: string) => http.delete<{ saved: false }>(`events/${id}/save`),
};
