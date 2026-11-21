import type { ConnectionIntent } from "../../types/enums";
import { http } from "../http";

type RequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN" | "REMOVED";
type State = "OPEN" | "FULL" | "CLOSED" | "CANCELLED" | "EXPIRED" | "UNAVAILABLE";
type Member = { userId: string; name: string };
export type Venue = { id: string; name: string; publicLocality: string };

export interface CircleActivity {
  id: string;
  redacted: boolean;
  title: string;
  description: string;
  startsAt: string | null;
  venue: Venue | null;
  openToNearby: boolean;
  helpNeeds: string[];
  state: State;
  capacity: number;
  approvedCount: number;
  version: number;
  mine: { need: number; status: RequestStatus }[];
}

export interface CircleSummary {
  id: string;
  redacted: boolean;
  title: string;
  description: string;
  intent: ConnectionIntent | null;
  locality: string;
  capacity: number;
  approvedCount: number;
  ownStatus: RequestStatus | null;
  state: State;
  organizer: boolean;
  activities: CircleActivity[];
}

export type CircleListScope = "own" | "nearby";

export interface CircleDetail extends CircleSummary {
  intent: ConnectionIntent;
  chatId: string | null;
  reportableOrganizerId: string | null;
  members: Member[];
  requests: Member[];
  activities: (CircleActivity & { requests: (Member & { need: number; status: RequestStatus })[] })[];
}

type ActivityInput = Pick<CircleActivity, "title" | "description" | "startsAt" | "openToNearby" | "capacity"> & { venueId: string | null };

export interface CheckIn {
  intent: { version: number; mine: ConnectionIntent | null; common: ConnectionIntent | null; pending: boolean };
  vibe: {
    version: number;
    prompts: string[];
    state: "IDLE" | "INVITED" | "CAN_ACCEPT" | "ANSWER" | "WAITING" | "SHARED";
    mine: string[];
    theirs: string[];
  };
}

const circle = (id: string) => `social/circles/${id}`;
const activity = (id: string, activityId: string) => `${circle(id)}/activities/${activityId}`;
const checkIn = (id: string) => `social/conversations/${id}/check-in`;

export const socialApi = {
  status: () => http.get<{ circles: boolean; checkIn: boolean; firstConnections: boolean }>("social/status"),
  list: (scope: CircleListScope, cursor?: string) => http.get<{ items: CircleSummary[]; nextCursor: string | null }>(
    "social/circles", { scope, cursor },
  ),
  venues: () => http.get<{ items: Venue[] }>("social/venues"),
  circle: (id: string) => http.get<CircleDetail>(circle(id)),
  create: (body: Pick<CircleSummary, "title" | "description" | "capacity"> & { intent: ConnectionIntent }) =>
    http.post<{ id: string }>("social/circles", body),
  join: (id: string) => http.put(`${circle(id)}/membership`),
  leave: (id: string) => http.delete(`${circle(id)}/membership`),
  decide: (id: string, targetId: string, approve: boolean) => http.put(`${circle(id)}/members/${targetId}`, { approve }),
  remove: (id: string, targetId: string) => http.delete(`${circle(id)}/members/${targetId}`),
  recover: (id: string) => http.put(`${circle(id)}/recovery`),
  close: (id: string, cancel: boolean) => http.put(`${circle(id)}/close`, { cancel }),
  createActivity: (id: string, body: ActivityInput & { helpNeeds: string[] }) => http.post(`${circle(id)}/activities`, body),
  updateActivity: (id: string, activityId: string, body: ActivityInput & { version: number }) =>
    http.put(activity(id, activityId), body),
  cancelActivity: (id: string, activityId: string) => http.delete(activity(id, activityId)),
  respond: (id: string, activityId: string, need: number, withdraw: boolean) => {
    const path = `${activity(id, activityId)}/responses/${need}`;
    return withdraw ? http.delete(path) : http.put(path);
  },
  decideActivity: (id: string, activityId: string, need: number, targetId: string, approve: boolean) =>
    http.put(`${activity(id, activityId)}/responses/${need}/${targetId}`, { approve }),
  currentCircleChat: (id: string) => http.get<{ conversationId: string }>(`social/conversations/${id}/current-circle-chat`),
  checkIn: (id: string) => http.get<CheckIn>(checkIn(id)),
  setIntent: (id: string, intent: ConnectionIntent | null, version: number) =>
    http.put<CheckIn>(`${checkIn(id)}/intent`, { intent, version }),
  vibe: (id: string, action: "START" | "ACCEPT" | "ANSWER" | "SKIP", version: number, answers?: string[]) =>
    http.put<CheckIn>(`${checkIn(id)}/vibe`, { action, version, answers }),
};
