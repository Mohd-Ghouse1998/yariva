import { http } from "../http";

export interface AnalyticsEventInput {
  name: string;
  occurredAt?: string;
  properties?: Record<string, unknown>;
  contextId?: string | null;
  clientEventId?: string | null;
}

export const analyticsApi = {
  ingest: (events: AnalyticsEventInput[]) =>
    http.post<{ acceptedCount: number }>("analytics/events", {
      events: events.map((event) => ({
        clientEventId: event.clientEventId ?? undefined,
        eventName: event.name,
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        source: "MOBILE",
        properties: event.contextId
          ? { ...(event.properties ?? {}), contextId: event.contextId }
          : (event.properties ?? {}),
      })),
    }),
};
