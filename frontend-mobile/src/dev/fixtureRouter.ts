// Maps backend HTTP requests to fixtures so screens render without a server.
// Activated by setting EXPO_PUBLIC_USE_FIXTURES=1 in .env.
//
// Demo mutations are persisted locally so fixture journeys survive a reload.
// The persisted state contains only bundled fictional profiles and can be reset
// with resetFixtureDemoState(). Production builds always bypass fixtures.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fixtureCall,
  fixtureConversations,
  fixtureCurrentUser,
  fixtureDatePlans,
  fixtureDiscoveryFeed,
  fixtureGetMe,
  fixtureInterests,
  fixtureMatches,
  fixtureMessagesByConversation,
  fixtureMyProfile,
  fixtureNotifications,
  fixtureReceivedLikes,
  fixtureSessions,
  ids,
} from "./fixtures";
import type { HttpMethod } from "../api/http";
import type { AuthResponseDto, RefreshResponseDto } from "../types/auth";
import type { CallSessionDto } from "../types/call";
import type {
  ConversationSummaryDto,
  FinalizeMessageAttachmentRequest,
  MessageDto,
  MessagePageDto,
} from "../types/conversation";
import type { CreateLikeResponseDto, ReceivedLikePreviewDto } from "../types/discovery";
import type {
  DatePlanDto,
  DateSafetyStatus,
  VenueSuggestion,
} from "../types/datePlan";
import type { MatchSummaryDto } from "../types/match";
import type { VibeDto } from "../types/vibe";

export interface FixtureRequest {
  method: HttpMethod;
  path: string; // already stripped of base URL and query
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

const tokens = {
  accessToken: "fixture-access-token",
  accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  refreshToken: "fixture-refresh-token",
  refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
  session: {
    id: "fixture-session",
    deviceId: "fixture-device",
    deviceName: "Fixture device",
    platform: "IOS" as const,
    appVersion: "0.1.0",
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    isCurrent: true,
  },
};

const authResponse: AuthResponseDto = {
  tokens,
  user: fixtureCurrentUser,
  profileCompletion: fixtureGetMe.profileCompletion,
};

const refreshResponse: RefreshResponseDto = {
  tokens,
  user: fixtureCurrentUser,
};

const FIXTURE_STATE_KEY = "@aroha/dev-fixture-state/v1";

interface PersistedFixtureState {
  version: 1;
  receivedLikes: ReceivedLikePreviewDto[];
  matches: MatchSummaryDto[];
  conversations: ConversationSummaryDto[];
  messagesByConversation: Record<string, MessagePageDto>;
  readSequenceByConversation: Record<string, number>;
}

const initialMessages = (): Record<string, MessagePageDto> =>
  Object.fromEntries(
    Object.entries(fixtureMessagesByConversation).map(([conversationId, page]) => [
      conversationId,
      { ...page, items: [...page.items] },
    ]),
  );

let receivedLikes: ReceivedLikePreviewDto[] = [...fixtureReceivedLikes.items];
let matches: MatchSummaryDto[] = [...fixtureMatches.items];
let conversations: ConversationSummaryDto[] = [...fixtureConversations.items];
let messagesByConversation: Record<string, MessagePageDto> = initialMessages();
let readSequenceByConversation: Record<string, number> = {};
let calls: CallSessionDto[] = [];
let currentVibe: VibeDto | null = null;
let datePlans: DatePlanDto[] = fixtureDatePlans.items.map((plan) => ({
  ...plan,
  responses: [...plan.responses],
}));
const fixtureVenues: VenueSuggestion[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Yariva Test Venue — Jubilee Studio",
    photoUrl: null,
    address: "Synthetic address for local development only",
    publicLocality: "Jubilee Hills",
    reviewLabel: "Venue details reviewed",
    reviewSource: "YARIVA_SYNTHETIC_FIXTURE",
    reviewedAt: new Date().toISOString(),
    availability: "OPEN",
    category: "ACTIVITY",
    priceTier: "₹₹",
    rating: 4.7,
    ratingCount: 286,
    distanceKm: 3.2,
    accessibilityFacts: [],
    atmosphereTags: ["CALM", "CREATIVE"],
    isSynthetic: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Yariva Test Venue — Madhapur Commons",
    photoUrl: null,
    address: "Synthetic address for local development only",
    publicLocality: "Madhapur",
    reviewLabel: "Venue details reviewed",
    reviewSource: "YARIVA_SYNTHETIC_FIXTURE",
    reviewedAt: new Date().toISOString(),
    availability: "UNKNOWN",
    category: "CAFE",
    priceTier: null,
    rating: 4.8,
    ratingCount: 514,
    distanceKm: 1.4,
    accessibilityFacts: [],
    atmosphereTags: ["CALM", "FOOD_AND_CONVERSATION"],
    isSynthetic: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Yariva Test Venue — Hitec Table",
    photoUrl: null,
    address: "Synthetic address for local development only",
    publicLocality: "Hitec City",
    reviewLabel: "Venue details reviewed",
    reviewSource: "YARIVA_SYNTHETIC_FIXTURE",
    reviewedAt: new Date().toISOString(),
    availability: "OPEN",
    category: "RESTAURANT",
    priceTier: "₹₹",
    rating: 4.9,
    ratingCount: 641,
    distanceKm: 2.1,
    accessibilityFacts: [],
    atmosphereTags: ["CALM", "FOOD_AND_CONVERSATION"],
    isSynthetic: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "Yariva Test Venue — Central Coffee Room",
    photoUrl: null,
    address: "Synthetic address for local development only",
    publicLocality: "Abids",
    reviewLabel: "Venue details reviewed",
    reviewSource: "YARIVA_SYNTHETIC_FIXTURE",
    reviewedAt: new Date().toISOString(),
    availability: "OPEN",
    category: "CAFE",
    priceTier: "₹₹",
    rating: 4.6,
    ratingCount: 802,
    distanceKm: 1.6,
    accessibilityFacts: [],
    atmosphereTags: ["CALM", "FOOD_AND_CONVERSATION"],
    isSynthetic: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    name: "Yariva Test Venue — Koti Social Table",
    photoUrl: null,
    address: "Synthetic address for local development only",
    publicLocality: "Koti",
    reviewLabel: "Venue details reviewed",
    reviewSource: "YARIVA_SYNTHETIC_FIXTURE",
    reviewedAt: new Date().toISOString(),
    availability: "OPEN",
    category: "RESTAURANT",
    priceTier: "₹₹",
    rating: 4.7,
    ratingCount: 925,
    distanceKm: 0.1,
    accessibilityFacts: [],
    atmosphereTags: ["PLAYFUL", "FOOD_AND_CONVERSATION"],
    isSynthetic: true,
  },
];
let fixtureStateHydrated = false;
let fixtureHydration: Promise<void> | null = null;

const resetFixtureMemory = (): void => {
  receivedLikes = [...fixtureReceivedLikes.items];
  matches = [...fixtureMatches.items];
  conversations = [...fixtureConversations.items];
  messagesByConversation = initialMessages();
  readSequenceByConversation = {};
  calls = [];
  currentVibe = null;
};

const hydrateFixtureState = async (): Promise<void> => {
  if (fixtureStateHydrated) return;
  if (fixtureHydration) return fixtureHydration;

  fixtureHydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(FIXTURE_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as Partial<PersistedFixtureState>;
      if (
        state.version !== 1 ||
        !Array.isArray(state.receivedLikes) ||
        !Array.isArray(state.matches) ||
        !Array.isArray(state.conversations) ||
        !state.messagesByConversation ||
        typeof state.messagesByConversation !== "object"
      ) {
        return;
      }
      receivedLikes = state.receivedLikes;
      matches = state.matches;
      conversations = state.conversations;
      messagesByConversation = state.messagesByConversation;
      readSequenceByConversation = state.readSequenceByConversation ?? {};
    } catch {
      resetFixtureMemory();
    } finally {
      fixtureStateHydrated = true;
      fixtureHydration = null;
    }
  })();

  return fixtureHydration;
};

const persistFixtureState = async (): Promise<void> => {
  const state: PersistedFixtureState = {
    version: 1,
    receivedLikes,
    matches,
    conversations,
    messagesByConversation,
    readSequenceByConversation,
  };
  try {
    await AsyncStorage.setItem(FIXTURE_STATE_KEY, JSON.stringify(state));
  } catch {
    // Demo persistence is best-effort; the in-memory fixture remains usable.
  }
};

/** Development-only utility for returning demo data to its seeded state. */
export const resetFixtureDemoState = async (): Promise<void> => {
  resetFixtureMemory();
  fixtureStateHydrated = true;
  fixtureHydration = null;
  await AsyncStorage.removeItem(FIXTURE_STATE_KEY);
};

const nowIso = () => new Date().toISOString();

function findProfile(userId: string) {
  return fixtureDiscoveryFeed.items.find((profile) => profile.userId === userId) ?? null;
}

function ensureFixtureMatch(targetUserId: string): {
  match: MatchSummaryDto | null;
  conversation: ConversationSummaryDto | null;
} {
  const profile = findProfile(targetUserId);
  if (!profile) return { match: null, conversation: null };

  const existing = matches.find((match) => match.otherUser.userId === targetUserId);
  if (existing) {
    return {
      match: existing,
      conversation: conversations.find((c) => c.matchId === existing.id) ?? null,
    };
  }

  const matchedAt = nowIso();
  const matchId = `fixture-match-${targetUserId}`;
  const conversationId = `fixture-conv-${targetUserId}`;
  const match: MatchSummaryDto = {
    id: matchId,
    status: "ACTIVE",
    matchedAt,
    endedAt: null,
    endedReason: null,
    otherUser: profile,
    conversationId,
    myCommunicationSetting: {
      matchId,
      userId: ids.ME_ID,
      allowVoiceCalls: true,
      allowVideoCalls: true,
      muted: false,
      updatedAt: matchedAt,
    },
    lastMessagePreview: null,
    lastMessageSentAt: null,
  };
  const conversation: ConversationSummaryDto = {
    kind: "SOLO",
    duoMatchId: null,
    participants: [profile],
    readStates: [],
    id: conversationId,
    matchId,
    status: "ACTIVE",
    otherUser: profile,
    lastMessageSequence: 0,
    lastMessagePreview: null,
    lastMessageType: null,
    lastMessageSentAt: null,
    lastSenderId: null,
    lastReadSequence: 0,
    unreadCount: 0,
    closedAt: null,
    closedReason: null,
    createdAt: matchedAt,
    updatedAt: matchedAt,
  };

  matches = [match, ...matches];
  conversations = [conversation, ...conversations];
  messagesByConversation = {
    ...messagesByConversation,
    [conversationId]: { items: [], nextCursor: null },
  };

  return { match, conversation };
}

function buildFixtureCall(input: { matchId: string; callType: "VOICE" | "VIDEO" }): CallSessionDto {
  const match = matches.find((m) => m.id === input.matchId) ?? fixtureMatches.items[0]!;
  const conversation =
    conversations.find((c) => c.matchId === match.id) ??
    conversations.find((c) => c.id === match.conversationId) ??
    fixtureConversations.items[0]!;
  const createdAt = nowIso();

  return {
    ...fixtureCall,
    id: `fixture-call-${Date.now()}`,
    matchId: match.id,
    conversationId: conversation.id,
    initiatorUserId: ids.ME_ID,
    receiverUserId: match.otherUser.userId,
    callType: input.callType,
    status: "RINGING",
    ringStartedAt: createdAt,
    acceptedAt: null,
    connectedAt: null,
    endedAt: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    endReason: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function requireDatePlan(id: string): DatePlanDto {
  const plan = datePlans.find((item) => item.id === id);
  if (!plan) throw new Error(`Fixture date plan not found: ${id}`);
  return plan;
}

function replaceDatePlan(plan: DatePlanDto): DatePlanDto {
  datePlans = datePlans.map((item) => (item.id === plan.id ? plan : item));
  return plan;
}

function acceptedFixturePlan(plan: DatePlanDto): DatePlanDto {
  const match = matches.find((item) => item.id === plan.matchId);
  const otherUserId = match?.otherUser.userId ?? "fixture-other-user";
  const respondedAt = nowIso();
  const responses = [
    ...plan.responses.filter(
      (item) => !(item.userId === otherUserId && item.proposalVersion === plan.proposalVersion),
    ),
    {
      userId: otherUserId,
      response: "ACCEPTED" as const,
      proposalVersion: plan.proposalVersion,
      respondedAt,
    },
  ];
  const bothAccepted = [ids.ME_ID, otherUserId].every((userId) =>
    responses.some(
      (item) =>
        item.userId === userId &&
        item.proposalVersion === plan.proposalVersion &&
        item.response === "ACCEPTED",
    ),
  );

  return replaceDatePlan({
    ...plan,
    status: bothAccepted ? "ACCEPTED" : "PROPOSED",
    responses,
    venueName: bothAccepted ? (plan.venueName ?? "Selected public venue") : null,
    venueAddress: bothAccepted
      ? (plan.venueAddress ?? `${plan.publicLocality}, Hyderabad (public meeting point)`)
      : null,
    exactVenueVisibleAt: bothAccepted ? respondedAt : null,
    acceptedAt: bothAccepted ? respondedAt : null,
    updatedAt: respondedAt,
  });
}

export function isFixturesEnabled(): boolean {
  // Keep direct property access so Expo embeds the explicit demo setting in a
  // standalone release APK.
  const value = process.env.EXPO_PUBLIC_USE_FIXTURES;
  const explicitlyEnabled = value === "1" || value === "true";
  // Expo only substitutes variables that are referenced from a public bundle
  // expression. Keeping the direct access here is intentional; the internal
  // device-demo APK must carry this flag after Metro minification.
  const demoValue = process.env.EXPO_PUBLIC_DEMO_MODE;
  // A release APK only serves fixtures when it was explicitly built as the
  // internal demo. Public production builds continue to require live APIs.
  const explicitDemoBuild = demoValue === "1" || demoValue === "true";
  const developmentBuild =
    typeof __DEV__ !== "undefined"
      ? __DEV__
      : !(typeof process !== "undefined" && process.env?.NODE_ENV === "production");
  return explicitlyEnabled && (developmentBuild || explicitDemoBuild);
}

export async function handleFixture<T>(req: FixtureRequest): Promise<T> {
  await hydrateFixtureState();
  const path = req.path.replace(/^\/+/, "");
  const segments = path.split("/");

  // ----- Auth -----
  if (path === "auth/signup" && req.method === "POST") return authResponse as unknown as T;
  if (path === "auth/login" && req.method === "POST") return authResponse as unknown as T;
  if (path === "auth/refresh" && req.method === "POST") return refreshResponse as unknown as T;
  if (path === "auth/logout" && req.method === "POST") return undefined as unknown as T;

  // ----- Vibe -----
  if (path === "vibes/me" && req.method === "GET") {
    return { vibe: currentVibe } as unknown as T;
  }
  if (segments[0] === "vibes" && segments[1] === "users" && req.method === "GET") {
    return { vibe: currentVibe?.status === "READY" ? currentVibe : null } as unknown as T;
  }
  if (path === "vibes/upload" && req.method === "POST") {
    const body = req.body as {
      filter?: VibeDto["filter"];
      audioMode?: VibeDto["audioMode"];
      music?: { fileName?: string } | null;
    };
    const now = new Date().toISOString();
    const vibeId = `fixture-vibe-${Date.now()}`;
    currentVibe = {
      id: vibeId,
      userId: ids.ME_ID,
      status: "UPLOADING",
      filter: body.filter ?? "ORIGINAL",
      audioMode: body.audioMode ?? "ORIGINAL",
      musicName: body.music?.fileName ?? null,
      durationMs: null,
      playbackUrl: null,
      thumbnailUrl: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const instruction = (kind: "video" | "music") => ({
      uploadToken: `fixture-${kind}-${vibeId}`,
      objectKey: `demo/vibes/${vibeId}/${kind}`,
      bucket: "aroha-demo",
      method: "PUT" as const,
      uploadUrl: `fixture://vibe/${vibeId}/${kind}`,
      headers: {},
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      maxSizeBytes: kind === "video" ? 40 * 1024 * 1024 : 12 * 1024 * 1024,
    });
    return {
      vibeId,
      video: instruction("video"),
      music: body.music ? instruction("music") : null,
    } as unknown as T;
  }
  if (segments[0] === "vibes" && segments[2] === "finalize" && req.method === "POST") {
    if (!currentVibe || currentVibe.id !== segments[1]) {
      throw new Error("Fixture Vibe upload not found");
    }
    currentVibe = {
      ...currentVibe,
      status: "PROCESSING",
      updatedAt: new Date().toISOString(),
    };
    return { vibe: currentVibe } as unknown as T;
  }
  if (segments[0] === "vibes" && segments.length === 2 && req.method === "DELETE") {
    currentVibe = null;
    return undefined as unknown as T;
  }

  // ----- Users -----
  if (path === "users/me" && req.method === "GET") return fixtureGetMe as unknown as T;
  if (path === "users/me/intents" && req.method === "PUT")
    return { intents: (req.body as { intents?: unknown[] }).intents ?? [] } as unknown as T;
  if (path === "users/me/interests" && req.method === "PUT")
    return {
      interestIds: (req.body as { interestIds?: unknown[] }).interestIds ?? [],
    } as unknown as T;

  // ----- Profiles -----
  if (path === "profiles/me" && req.method === "GET") {
    return { profile: fixtureMyProfile } as unknown as T;
  }
  if (path === "profiles/me" && req.method === "PATCH")
    return {
      profile: { ...fixtureMyProfile, ...(req.body as object) },
    } as unknown as T;
  if (
    segments[0] === "profiles" &&
    segments.length === 2 &&
    segments[1] !== "me" &&
    req.method === "GET"
  ) {
    const profile = findProfile(decodeURIComponent(segments[1] ?? ""));
    if (!profile) throw new Error("Fixture profile not found");
    return { profile } as unknown as T;
  }
  if (path === "profiles/me/lifestyle" && req.method === "PUT")
    return { value: req.body } as unknown as T;
  if (path === "profiles/me/schedule-preference" && req.method === "PUT")
    return { value: req.body } as unknown as T;
  if (path === "profiles/me/discovery-preference" && req.method === "PUT")
    return { value: req.body } as unknown as T;
  if (path === "profiles/me/communication-preference" && req.method === "PUT")
    return { value: req.body } as unknown as T;

  // ----- Profile photos -----
  if (path === "profiles/photos/upload" && req.method === "POST") {
    return {
      uploadToken: "fixture-upload-1",
      objectKey: "demo/me/new.jpg",
      bucket: "aroha-demo",
      method: "PUT",
      uploadUrl: "https://example.invalid/upload",
      headers: {},
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      maxSizeBytes: 10 * 1024 * 1024,
    } as unknown as T;
  }
  if (path === "profiles/photos/finalize" && req.method === "POST") {
    return {
      photo: {
        ...fixtureMyProfile.photos[0]!,
        id: `photo-${Date.now()}`,
        moderationStatus: "PENDING",
        approvedAt: null,
      },
      profileCompletion: fixtureMyProfile.completion,
    } as unknown as T;
  }
  if (path === "profiles/photos/order" && req.method === "PATCH")
    return { photos: fixtureMyProfile.photos } as unknown as T;
  if (
    segments[0] === "profiles" &&
    segments[1] === "photos" &&
    segments[3] === "primary" &&
    req.method === "PATCH"
  )
    return { photo: fixtureMyProfile.photos[0]! } as unknown as T;
  if (
    segments[0] === "profiles" &&
    segments[1] === "photos" &&
    segments.length === 3 &&
    req.method === "DELETE"
  )
    return undefined as unknown as T;

  // ----- Interests -----
  if (path === "interests" && req.method === "GET") return fixtureInterests as unknown as T;

  // ----- Discovery -----
  if (path === "discovery/feed" && req.method === "GET")
    return fixtureDiscoveryFeed as unknown as T;

  // ----- Likes / passes -----
  if (path === "likes/received" && req.method === "GET")
    return { items: receivedLikes, nextCursor: null } as unknown as T;
  if (path === "likes" && req.method === "POST") {
    const body = req.body as { targetUserId?: string; introNote?: string };
    const target = body.targetUserId;
    const introNote = body.introNote?.trim() || null;
    const likedAt = nowIso();
    const incomingIdx = target
      ? receivedLikes.findIndex((like) => like.actorUserId === target)
      : -1;
    const like = {
      id: `like-${Date.now()}`,
      actorId: ids.ME_ID,
      targetId: target ?? "",
      introNote,
      status: incomingIdx >= 0 ? "MATCHED" : "ACTIVE",
      matchedAt: incomingIdx >= 0 ? likedAt : null,
      retractedAt: null,
      createdAt: likedAt,
      updatedAt: likedAt,
    } satisfies CreateLikeResponseDto["like"];

    if (target && incomingIdx >= 0) {
      receivedLikes = receivedLikes.filter((likePreview) => likePreview.actorUserId !== target);
      const { match, conversation } = ensureFixtureMatch(target);
      await persistFixtureState();
      return {
        outcome: "MATCH_CREATED",
        like,
        match,
        conversation,
      } satisfies CreateLikeResponseDto as unknown as T;
    }

    return {
      outcome: "LIKE_RECORDED",
      like: {
        ...like,
        status: "ACTIVE",
        matchedAt: null,
      },
      match: null,
      conversation: null,
    } satisfies CreateLikeResponseDto as unknown as T;
  }
  if (segments[0] === "likes" && req.method === "DELETE") return undefined as unknown as T;
  if (path === "passes" && req.method === "POST") {
    return {
      id: `pass-${Date.now()}`,
      passerUserId: ids.ME_ID,
      passedUserId: (req.body as { targetUserId?: string }).targetUserId ?? "",
      createdAt: new Date().toISOString(),
    } as unknown as T;
  }
  if (segments[0] === "passes" && req.method === "DELETE") return undefined as unknown as T;

  // ----- Matches -----
  if (path === "matches" && req.method === "GET")
    return { items: matches, nextCursor: null } as unknown as T;
  if (segments[0] === "matches" && segments.length === 2 && req.method === "GET") {
    const id = segments[1];
    const m = matches.find((x) => x.id === id);
    if (m) {
      return {
        match: {
          ...m,
          otherUserCommunicationAllowed: {
            allowVoiceCalls: true,
            allowVideoCalls: true,
          },
        },
      } as unknown as T;
    }
  }
  if (segments[0] === "matches" && segments.length === 2 && req.method === "DELETE") {
    const id = segments[1];
    const m = matches.find((x) => x.id === id);
    if (id) {
      matches = matches.filter((match) => match.id !== id);
      conversations = conversations.filter((conversation) => conversation.matchId !== id);
    }
    await persistFixtureState();
    return { match: m ?? fixtureMatches.items[0]! } as unknown as T;
  }
  if (
    segments[0] === "matches" &&
    segments[2] === "communication-settings" &&
    segments[3] === "me" &&
    req.method === "PUT"
  ) {
    return {
      setting: {
        ...matches[0]!.myCommunicationSetting,
        ...(req.body as object),
        updatedAt: new Date().toISOString(),
      },
    } as unknown as T;
  }

  // ----- Intentional Date Plans -----
  if (
    segments[0] === "matches" &&
    segments[2] === "venue-suggestions" &&
    req.method === "GET"
  ) {
    const query = String(req.query?.query ?? "").trim().toLocaleLowerCase();
    const category = String(req.query?.category ?? "");
    const locationMode = String(req.query?.locationMode ?? "MIDPOINT");
    const area = String(req.query?.area ?? "").trim().toLocaleLowerCase();
    return {
      items: fixtureVenues.filter(
        (venue) =>
          (!category || venue.category === category) &&
          (locationMode !== "AREA" || !area || `${venue.address} ${venue.publicLocality}`.toLocaleLowerCase().includes(area)) &&
          (!query || `${venue.name} ${venue.address} ${venue.publicLocality}`.toLocaleLowerCase().includes(query)),
      ).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)),
      manualFallbackAvailable: true,
    } as unknown as T;
  }
  if (
    segments[0] === "matches" &&
    segments[2] === "date-plans" &&
    segments.length === 3 &&
    req.method === "GET"
  ) {
    return {
      items: datePlans.filter((plan) => plan.matchId === segments[1]),
      nextCursor: null,
    } as unknown as T;
  }
  if (
    segments[0] === "matches" &&
    segments[2] === "date-plans" &&
    segments.length === 3 &&
    req.method === "POST"
  ) {
    const body = req.body as {
      title?: string;
      description?: string;
      activityType?: string;
      proposedStartAt?: string;
      durationMinutes?: number;
      timezone?: string;
      publicLocality?: string;
      reviewedVenueId?: string | null;
      venueName?: string | null;
      venueAddress?: string | null;
    };
    const createdAt = nowIso();
    const reviewedVenue = fixtureVenues.find((venue) => venue.id === body.reviewedVenueId);
    const datePlan: DatePlanDto = {
      id: `fixture-date-plan-${Date.now()}`,
      matchId: segments[1]!,
      createdByUserId: ids.ME_ID,
      status: "PROPOSED",
      proposalVersion: 1,
      title: body.title ?? "A thoughtful first date",
      description: body.description ?? "A relaxed public plan with time to talk.",
      activityType: body.activityType ?? "PUBLIC_CAFE_AND_ACTIVITY",
      proposedStartAt:
        body.proposedStartAt ?? new Date(Date.now() + 72 * 60 * 60_000).toISOString(),
      durationMinutes: body.durationMinutes ?? 120,
      timezone: body.timezone ?? "Asia/Kolkata",
      publicLocality: body.publicLocality ?? "Jubilee Hills",
      venueName: reviewedVenue?.name ?? body.venueName ?? null,
      venuePhotoUrl: reviewedVenue?.photoUrl ?? null,
      venueAddress: reviewedVenue?.address ?? body.venueAddress ?? null,
      latitude: null,
      longitude: null,
      exactVenueVisibleAt: createdAt,
      acceptedAt: null,
      declinedAt: null,
      cancelledAt: null,
      completedAt: null,
      responses: [
        {
          userId: ids.ME_ID,
          response: "ACCEPTED",
          proposalVersion: 1,
          respondedAt: createdAt,
        },
      ],
      mySafetyStatus: null,
      myPostDateResponseSubmitted: false,
      meetAgainOutcome: null,
      createdAt,
      updatedAt: createdAt,
    };
    datePlans = [datePlan, ...datePlans];
    return { datePlan } as unknown as T;
  }
  if (path === "date-plans" && req.method === "GET") {
    return { items: datePlans, nextCursor: null } as unknown as T;
  }
  if (segments[0] === "date-plans" && segments.length === 2 && req.method === "GET") {
    return { datePlan: requireDatePlan(segments[1]!) } as unknown as T;
  }
  if (segments[0] === "date-plans" && segments.length === 3 && req.method === "POST") {
    const id = segments[1]!;
    const action = segments[2]!;
    const current = requireDatePlan(id);
    const changedAt = nowIso();

    if (action === "accept") return { datePlan: acceptedFixturePlan(current) } as unknown as T;
    if (action === "counter") {
      const body = req.body as Partial<DatePlanDto> & { reviewedVenueId?: string | null };
      const reviewedVenue = fixtureVenues.find((venue) => venue.id === body.reviewedVenueId);
      const datePlanChanges = { ...body };
      delete datePlanChanges.reviewedVenueId;
      const proposalVersion = current.proposalVersion + 1;
      const datePlan = replaceDatePlan({
        ...current,
        ...datePlanChanges,
        status: "COUNTERED",
        proposalVersion,
        venueName: reviewedVenue?.name ?? body.venueName ?? current.venueName,
        venueAddress: reviewedVenue?.address ?? body.venueAddress ?? current.venueAddress,
        publicLocality: reviewedVenue?.publicLocality ?? body.publicLocality ?? current.publicLocality,
        latitude: null,
        longitude: null,
        exactVenueVisibleAt: changedAt,
        acceptedAt: null,
        responses: [
          {
            userId: ids.ME_ID,
            response: "ACCEPTED",
            proposalVersion,
            respondedAt: changedAt,
          },
        ],
        updatedAt: changedAt,
      });
      return { datePlan } as unknown as T;
    }
    if (action === "decline" || action === "cancel" || action === "complete") {
      const status =
        action === "decline" ? "DECLINED" : action === "cancel" ? "CANCELLED" : "COMPLETED";
      const datePlan = replaceDatePlan({
        ...current,
        status,
        declinedAt: action === "decline" ? changedAt : current.declinedAt,
        cancelledAt: action === "cancel" ? changedAt : current.cancelledAt,
        completedAt: action === "complete" ? changedAt : current.completedAt,
        updatedAt: changedAt,
      });
      return { datePlan } as unknown as T;
    }
    if (action === "check-in") {
      const body = req.body as { safetyStatus?: DateSafetyStatus };
      const datePlan = replaceDatePlan({
        ...current,
        mySafetyStatus: body.safetyStatus ?? "OKAY",
        updatedAt: changedAt,
      });
      return { datePlan } as unknown as T;
    }
    if (action === "post-date-response") {
      const body = req.body as { wantsToMeetAgain?: boolean };
      const datePlan = replaceDatePlan({
        ...current,
        myPostDateResponseSubmitted: true,
        meetAgainOutcome: body.wantsToMeetAgain ? "MUTUAL" : "NOT_MUTUAL",
        updatedAt: changedAt,
      });
      return { datePlan } as unknown as T;
    }
  }

  // ----- Conversations -----
  if (path === "conversations" && req.method === "GET")
    return { items: conversations, nextCursor: null } as unknown as T;
  if (segments[0] === "conversations" && segments.length === 2 && req.method === "GET") {
    const id = segments[1];
    const c = conversations.find((x) => x.id === id);
    if (c) return { conversation: c } as unknown as T;
  }
  if (
    segments[0] === "conversations" &&
    segments[2] === "messages" &&
    segments.length === 3 &&
    req.method === "GET"
  ) {
    return (messagesByConversation[segments[1]!] ?? {
      items: [],
      nextCursor: null,
    }) as unknown as T;
  }
  if (
    segments[0] === "conversations" &&
    segments[2] === "messages" &&
    segments.length === 3 &&
    req.method === "POST"
  ) {
    const conversationId = segments[1]!;
    const body = req.body as { textBody?: string; type?: string; clientMessageId?: string };
    const existingPage = messagesByConversation[conversationId] ?? { items: [], nextCursor: null };
    const duplicate = body.clientMessageId
      ? existingPage.items.find((item) => item.clientMessageId === body.clientMessageId)
      : undefined;
    if (duplicate) return { message: duplicate } as unknown as T;
    const textBody = body.textBody?.trim().slice(0, 5_000) ?? "";
    if (!textBody) throw new Error("Fixture message text is required");
    const sequence =
      existingPage.items.reduce((max, message) => Math.max(max, Math.ceil(message.sequence)), 0) +
      1;
    const sentAt = nowIso();
    const message: MessageDto = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: ids.ME_ID,
      sequence,
      clientMessageId: body.clientMessageId ?? null,
      type: (body.type as "TEXT") ?? "TEXT",
      textBody,
      attachment: {
        objectKey: null,
        url: null,
        mimeType: null,
        sizeBytes: null,
        width: null,
        height: null,
        durationSeconds: null,
        moderationStatus: null,
      },
      status: "ACTIVE",
      replyToMessageId: null,
      editedAt: null,
      deletedAt: null,
      createdAt: sentAt,
      updatedAt: sentAt,
    };

    messagesByConversation = {
      ...messagesByConversation,
      [conversationId]: {
        ...existingPage,
        items: [...existingPage.items, message],
      },
    };
    conversations = conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            lastMessageSequence: sequence,
            lastMessagePreview: message.textBody,
            lastMessageType: message.type,
            lastMessageSentAt: sentAt,
            lastSenderId: ids.ME_ID,
            updatedAt: sentAt,
          }
        : conversation,
    );
    matches = matches.map((match) =>
      match.conversationId === conversationId
        ? {
            ...match,
            lastMessagePreview: message.textBody,
            lastMessageSentAt: sentAt,
          }
        : match,
    );

    await persistFixtureState();
    return { message } as unknown as T;
  }
  if (segments[0] === "conversations" && segments[2] === "read" && req.method === "POST") {
    const conversationId = segments[1]!;
    const lastReadSequence =
      (req.body as { lastReadSequence?: number }).lastReadSequence ?? 0;
    readSequenceByConversation = {
      ...readSequenceByConversation,
      [conversationId]: lastReadSequence,
    };
    conversations = conversations.map((conversation) =>
      conversation.id === conversationId
        ? { ...conversation, lastReadSequence, unreadCount: 0 }
        : conversation,
    );
    const lastReadMessage = messagesByConversation[conversationId]?.items.find(
      (message) => message.sequence === lastReadSequence,
    );
    await persistFixtureState();
    return {
      readState: {
        conversationId,
        userId: ids.ME_ID,
        lastReadMessageId: lastReadMessage?.id ?? null,
        lastReadSequence,
        lastReadAt: nowIso(),
      },
    } as unknown as T;
  }

  // ----- Messages (attachments / edits / deletes) -----
  if (path === "messages/attachments/upload" && req.method === "POST") {
    const body = req.body as { conversationId?: string; fileName?: string };
    const uploadId = `fixture-msg-upload-${Date.now()}`;
    return {
      uploadToken: uploadId,
      objectKey: `demo/messages/${body.conversationId ?? "unknown"}/${uploadId}-${body.fileName ?? "image.jpg"}`,
      bucket: "aroha-demo",
      method: "PUT",
      uploadUrl: `fixture://message-attachment/${uploadId}`,
      headers: {},
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    } as unknown as T;
  }
  if (path === "messages/attachments/finalize" && req.method === "POST") {
    const body = req.body as FinalizeMessageAttachmentRequest & {
      fixturePreviewUri?: string;
    };
    const conversation = conversations.find((item) => item.id === body.conversationId);
    if (!conversation || conversation.status !== "ACTIVE") {
      throw new Error("Fixture conversation is not writable");
    }
    const existingPage = messagesByConversation[body.conversationId] ?? {
      items: [],
      nextCursor: null,
    };
    const duplicate = existingPage.items.find(
      (item) => item.clientMessageId === body.clientMessageId,
    );
    if (duplicate) return { message: duplicate } as unknown as T;
    const sequence =
      existingPage.items.reduce((max, item) => Math.max(max, Math.ceil(item.sequence)), 0) + 1;
    const createdAt = nowIso();
    const message: MessageDto = {
      id: `msg-${Date.now()}`,
      conversationId: body.conversationId,
      senderId: ids.ME_ID,
      sequence,
      clientMessageId: body.clientMessageId,
      type: body.type,
      textBody: null,
      attachment: {
        objectKey: body.objectKey,
        url:
          body.fixturePreviewUri ??
          `https://picsum.photos/seed/${encodeURIComponent(body.clientMessageId)}/600/800`,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        width: body.width ?? null,
        height: body.height ?? null,
        durationSeconds: body.durationSeconds ?? null,
        moderationStatus: "APPROVED",
      },
      status: "ACTIVE",
      replyToMessageId: body.replyToMessageId ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    messagesByConversation = {
      ...messagesByConversation,
      [body.conversationId]: {
        ...existingPage,
        items: [...existingPage.items, message],
      },
    };
    conversations = conversations.map((item) =>
      item.id === body.conversationId
        ? {
            ...item,
            lastMessageSequence: sequence,
            lastMessagePreview: "Photo",
            lastMessageType: body.type,
            lastMessageSentAt: createdAt,
            lastSenderId: ids.ME_ID,
            updatedAt: createdAt,
          }
        : item,
    );
    matches = matches.map((match) =>
      match.conversationId === body.conversationId
        ? { ...match, lastMessagePreview: "Photo", lastMessageSentAt: createdAt }
        : match,
    );
    await persistFixtureState();
    return {
      message,
    } as unknown as T;
  }

  // ----- Calls -----
  if (path === "calls" && req.method === "POST") {
    const body = req.body as { matchId?: string; callType?: "VOICE" | "VIDEO" };
    const call = buildFixtureCall({
      matchId: body.matchId ?? fixtureMatches.items[0]!.id,
      callType: body.callType ?? "VOICE",
    });
    calls = [call, ...calls];
    return {
      call,
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    } as unknown as T;
  }
  if (segments[0] === "calls" && segments[2] === "accept" && req.method === "POST") {
    const callId = segments[1];
    const call = calls.find((c) => c.id === callId) ?? fixtureCall;
    const acceptedAt = nowIso();
    const accepted = {
      ...call,
      status: "ACCEPTED" as const,
      acceptedAt,
      updatedAt: acceptedAt,
    };
    calls = calls.map((c) => (c.id === accepted.id ? accepted : c));
    return {
      call: accepted,
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    } as unknown as T;
  }
  if (
    segments[0] === "calls" &&
    (segments[2] === "decline" || segments[2] === "end") &&
    req.method === "POST"
  ) {
    const callId = segments[1];
    const call = calls.find((c) => c.id === callId) ?? fixtureCall;
    const endedAt = nowIso();
    const ended = {
      ...call,
      status: "ENDED" as const,
      endedAt,
      endReason: segments[2] === "decline" ? ("DECLINED" as const) : ("HANGUP" as const),
      updatedAt: endedAt,
    };
    calls = calls.map((c) => (c.id === ended.id ? ended : c));
    return { call: ended } as unknown as T;
  }

  // ----- Sessions / push tokens -----
  if (path === "sessions" && req.method === "GET") return fixtureSessions as unknown as T;
  if (path === "sessions/others" && req.method === "DELETE")
    return { revokedCount: 1 } as unknown as T;
  if (segments[0] === "sessions" && segments.length === 2 && req.method === "DELETE")
    return undefined as unknown as T;
  if (path === "push-tokens" && req.method === "POST") {
    return {
      id: `pt-${Date.now()}`,
      provider: "APNS",
      platform: "IOS",
      deviceId: "fixture-device",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as T;
  }
  if (segments[0] === "push-tokens" && segments.length === 2 && req.method === "DELETE")
    return undefined as unknown as T;

  // ----- Notifications -----
  if (path === "notifications" && req.method === "GET") return fixtureNotifications as unknown as T;
  if (segments[0] === "notifications" && segments[2] === "read" && req.method === "POST") {
    const n = fixtureNotifications.items.find((x) => x.id === segments[1]);
    return {
      notification: {
        ...(n ?? fixtureNotifications.items[0]!),
        status: "READ",
        readAt: new Date().toISOString(),
      },
    } as unknown as T;
  }

  // ----- Blocks / reports -----
  if (path === "blocks" && req.method === "POST") {
    return {
      block: {
        id: `b-${Date.now()}`,
        blockerId: ids.ME_ID,
        blockedId: (req.body as { blockedUserId?: string }).blockedUserId ?? "",
        reason: (req.body as { reason?: string }).reason ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } as unknown as T;
  }
  if (path === "blocks" && req.method === "GET")
    return { items: [], nextCursor: null } as unknown as T;
  if (segments[0] === "blocks" && segments.length === 2 && req.method === "DELETE")
    return undefined as unknown as T;
  if (path === "reports" && req.method === "POST") {
    const body = req.body as {
      targetType?: string;
      reportedUserId?: string;
      reasonCode?: string;
      description?: string | null;
    };
    return {
      report: {
        id: `r-${Date.now()}`,
        reporterUserId: ids.ME_ID,
        reportedUserId: body.reportedUserId ?? "",
        targetType: body.targetType ?? "USER",
        reasonCode: body.reasonCode ?? "OTHER",
        description: body.description ?? null,
        status: "OPEN",
        createdAt: new Date().toISOString(),
        closedAt: null,
      },
      isDuplicate: false,
      moderationCaseCreated: true,
    } as unknown as T;
  }
  if (path === "reports/me" && req.method === "GET")
    return { items: [], nextCursor: null } as unknown as T;

  // ----- Analytics -----
  if (path === "analytics/events" && req.method === "POST") {
    const body = req.body as { events?: unknown[] };
    return { acceptedCount: body.events?.length ?? 0 } as unknown as T;
  }

  // Events require reviewed real supply; development fixtures do not invent it.
  if (path === "events/status" && req.method === "GET") return { enabled: false } as T;

  // Fall through
  throw new Error(`Fixture route not implemented: ${req.method} ${path}`);
}
