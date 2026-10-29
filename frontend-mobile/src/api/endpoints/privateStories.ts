import { http } from "../http";
export type CommunityLabel =
  | "STRAIGHT"
  | "GAY"
  | "LESBIAN"
  | "BISEXUAL"
  | "PANSEXUAL"
  | "QUEER"
  | "ASEXUAL"
  | "QUESTIONING"
  | "SELF_DESCRIBE"
  | "PREFER_NOT_TO_SAY";
export const communityLabels: { value: CommunityLabel; label: string }[] = [
  { value: "STRAIGHT", label: "Straight" },
  { value: "GAY", label: "Gay" },
  { value: "LESBIAN", label: "Lesbian" },
  { value: "BISEXUAL", label: "Bisexual" },
  { value: "PANSEXUAL", label: "Pansexual" },
  { value: "QUEER", label: "Queer" },
  { value: "ASEXUAL", label: "Asexual" },
  { value: "QUESTIONING", label: "Questioning" },
  { value: "SELF_DESCRIBE", label: "Self describe" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];
export interface Story {
  id: string;
  ownerId: string;
  ownerName?: string;
  text: string;
  mediaMimeType: string | null;
  mediaUrl?: string | null;
  previewUrl?: string | null;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  audienceRule: "SELECTED" | "ALL_APPROVED";
  communityFilter: CommunityLabel | null;
  createdAt: string;
  expiresAt: string;
  savedAt?: string | null;
}
export interface StoryMedia {
  objectKey: string;
  uploadToken: string;
  mimeType: string;
  sizeBytes: number;
}
export interface Audience {
  audienceRule: "SELECTED" | "ALL_APPROVED";
  recipientIds?: string[];
  communityFilter?: CommunityLabel;
}
export interface CommunityPreferences {
  identifyAs: CommunityLabel[];
  connectWith: CommunityLabel[];
  optedInCommunities: CommunityLabel[];
  selfDescription: string | null;
}
export const privateStoriesApi = {
  capabilities: () => http.get<{ enabled: boolean }>("private-stories/capabilities"),
  connections: () =>
    http.get<{ recipientIds: string[]; people: { id: string; displayName: string }[] }>(
      "private-stories/connections",
    ),
  preview: (audience: Audience) =>
    http.post<{
      eligibleCount: number;
      audienceRule: string;
      communityFilter: CommunityLabel | null;
      lifetimeHours: number;
    }>("private-stories/audience-preview", audience),
  mine: (cursor?: string) =>
    http.get<{ items: Story[]; nextCursor: string | null }>("private-stories/me", { cursor }),
  saved: (cursor?: string) =>
    http.get<{ items: Story[]; nextCursor: string | null }>("private-stories/saved", { cursor }),
  setSaved: (id: string, saved: boolean) =>
    http.patch<{ story: Story }>(`private-stories/${id}/saved`, { saved }),
  feed: (cursor?: string) =>
    http.get<{ items: Story[]; nextCursor: string | null }>("private-stories/feed", { cursor }),
  detail: (id: string) =>
    http.get<{ story: Story; recipientIds?: string[] }>(`private-stories/${id}`),
  initiateMedia: (input: { mimeType: string; sizeBytes: number }) =>
    http.post<
      StoryMedia & { uploadUrl: string; uploadHeaders: Record<string, string>; expiresAt: string }
    >("private-stories/media/upload", input),
  create: (input: Audience & { text?: string; media?: StoryMedia }) =>
    http.post<{ story: Story; eligibleCount: number }>("private-stories", input),
  update: (id: string, input: Audience & { text?: string; confirmAudienceExpansion?: boolean }) =>
    http.patch<{ story: Story; eligibleCount: number }>(`private-stories/${id}`, input),
  remove: (id: string) => http.delete<{ deleted: boolean }>(`private-stories/${id}`),
  community: () => http.get<CommunityPreferences>("private-stories/community"),
  saveCommunity: (input: CommunityPreferences) =>
    http.patch<CommunityPreferences>("private-stories/community", input),
  followRequests: (cursor?: string) =>
    http.get<{
      items: {
        requesterId: string;
        displayName: string;
        city: string | null;
        photoUrl: string | null;
        createdAt: string;
      }[];
      nextCursor: string | null;
    }>("private-stories/follows/requests", { cursor }),
  followSummary: () =>
    http.get<{ followers: number; following: number; requests: number }>(
      "private-stories/follows/summary",
    ),
  followStatus: (ownerId: string) =>
    http.get<{ status: "NONE" | "PENDING" | "APPROVED" }>(
      `private-stories/follows/status/${ownerId}`,
    ),
  followers: (cursor?: string) =>
    http.get<{
      items: {
        userId: string;
        displayName: string;
        city: string | null;
        photoUrl: string | null;
      }[];
      nextCursor: string | null;
    }>("private-stories/follows/followers", { cursor }),
  following: (cursor?: string) =>
    http.get<{
      items: {
        userId: string;
        displayName: string;
        city: string | null;
        photoUrl: string | null;
      }[];
      nextCursor: string | null;
    }>("private-stories/follows/following", { cursor }),
  requestFollow: (ownerId: string) =>
    http.post<{ status: string }>(`private-stories/follows/${ownerId}`),
  approveFollow: (requesterId: string) =>
    http.post<{ status: string }>(`private-stories/follows/${requesterId}/approve`),
  revokeFollow: (requesterId: string) =>
    http.delete<{ revoked: boolean }>(`private-stories/follows/followers/${requesterId}`),
  cancelFollow: (ownerId: string) =>
    http.delete<{ revoked: boolean }>(`private-stories/follows/requested/${ownerId}`),
};
