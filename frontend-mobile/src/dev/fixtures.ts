// Typed sample data used by the dev "fixtures mode" so screens can render
// without a live backend. Set EXPO_PUBLIC_USE_FIXTURES=1 (or import this
// file directly in a story) to use them.

import type {
  CallSessionDto,
  DatePlanDto,
  DatePlanPageDto,
  ConversationSummaryDto,
  CurrentUserDto,
  DiscoveryFeedResponseDto,
  GetMeResponseDto,
  InterestTagPageDto,
  MatchPageDto,
  MatchSummaryDto,
  MessageDto,
  MessagePageDto,
  MyProfileDto,
  NotificationDto,
  NotificationPageDto,
  PublicProfileDto,
  ReceivedLikeIntent,
  ReceivedLikePreviewDto,
  ReceivedLikesResponseDto,
  SessionPageDto,
} from "../types";

const now = () => new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const ME_ID = "00000000-0000-0000-0000-00000000aaaa";
const ASHA_ID = "11111111-1111-1111-1111-111111111111";
const ROHAN_ID = "22222222-2222-2222-2222-222222222222";
const MEERA_ID = "33333333-3333-3333-3333-333333333333";
const KABIR_ID = "44444444-4444-4444-4444-444444444444";
const PRIYA_ID = "55555555-5555-5555-5555-555555555555";
const ARJUN_ID = "66666666-6666-6666-6666-666666666666";
const SARA_ID = "77777777-7777-7777-7777-777777777777";
const DEV_ID = "88888888-8888-8888-8888-888888888888";
const NADIA_ID = "99999999-9999-9999-9999-999999999999";
const MATCH_ASHA = "aaaa1111-1111-1111-1111-111111111111";
const MATCH_ROHAN = "aaaa2222-2222-2222-2222-222222222222";
const MATCH_MEERA = "aaaa3333-3333-3333-3333-333333333333";
const MATCH_KABIR = "aaaa4444-4444-4444-4444-444444444444";
const CONV_ASHA = "bbbb1111-1111-1111-1111-111111111111";
const CONV_ROHAN = "bbbb2222-2222-2222-2222-222222222222";
const CONV_MEERA = "bbbb3333-3333-3333-3333-333333333333";

// Real Unsplash portrait URLs so the dev fixtures look like real people on
// the Discover swipe deck. picsum returned scenic photos which made the
// preview feel wrong for a dating app.
const PORTRAIT_URLS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&q=80",
  "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=800&q=80",
  "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80",
  "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=800&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
];

const placeholderPhoto = (seed: number) => ({
  id: `photo-${seed}`,
  url: PORTRAIT_URLS[seed % PORTRAIT_URLS.length] ?? PORTRAIT_URLS[0]!,
  width: 800,
  height: 800,
  isPrimary: true,
  position: 0,
});

const baseInterests = [
  { id: "i-coffee", slug: "coffee", displayName: "Coffee", category: "food" },
  { id: "i-books", slug: "books", displayName: "Books", category: "culture" },
  { id: "i-music", slug: "music", displayName: "Music", category: "culture" },
  { id: "i-travel", slug: "travel", displayName: "Travel", category: "lifestyle" },
  { id: "i-fitness", slug: "fitness", displayName: "Fitness", category: "wellness" },
  { id: "i-hiking", slug: "hiking", displayName: "Hiking", category: "outdoors" },
  { id: "i-movies", slug: "movies", displayName: "Movies", category: "culture" },
  { id: "i-cooking", slug: "cooking", displayName: "Cooking", category: "food" },
];

export const fixtureInterests: InterestTagPageDto = { items: baseInterests, nextCursor: null };

export const fixtureCurrentUser: CurrentUserDto = {
  id: ME_ID,
  email: "chinmoy@aroha.dev",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  isShadowBanned: false,
  isDiscoveryFrozen: false,
  isChatFrozen: false,
  isCallFrozen: false,
  lastActiveAt: now(),
  createdAt: hoursAgo(72),
  updatedAt: now(),
};

export const fixtureGetMe: GetMeResponseDto = {
  user: fixtureCurrentUser,
  profileCompletion: { isComplete: true, completedAt: hoursAgo(24), missingCriteria: [] },
};

export const fixtureMyProfile: MyProfileDto = {
  userId: ME_ID,
  displayName: "Chinmoy",
  headline: "Slow coffee · Long walks · Building Yariva",
  bio: "Founder, friend, occasional cyclist. Looking to meet people who care about the same small things — books, kind conversation, weekend trails.",
  dateOfBirth: "1994-06-15T00:00:00.000Z",
  gender: "MAN",
  pronouns: "he/him",
  city: "Hyderabad",
  region: "Telangana",
  countryCode: "IN",
  locationLat: 17.385,
  locationLng: 78.4867,
  hideAge: false,
  hideDistance: false,
  isHidden: false,
  isIncognito: false,
  hideFromContacts: true,
  isPaused: false,
  verificationStatus: "VERIFIED",
  preferredRelationshipPace: "INTENTIONAL",
  languages: ["English", "Hindi", "Telugu"],
  foodPreferences: ["Halal-friendly", "Vegetarian-friendly"],
  relocationOpenness: "Open to discussing",
  careerPriority: "Important, with balance",
  familyInvolvementComfort: "Comfortable after trust develops",
  marriageTimeline: "No fixed timeline",
  childrenPreference: "Open to children",
  religionSpirituality: null,
  shareSensitiveCompatibility: false,
  promptResponses: [
    {
      promptId: "ideal_sunday",
      answer: "Coffee, a long walk and one conversation that makes time disappear.",
    },
  ],
  isComplete: true,
  completedAt: hoursAgo(24),
  photos: [
    {
      id: "p-me-1",
      objectKey: "demo/me/primary.jpg",
      bucket: "aroha-demo",
      mimeType: "image/jpeg",
      sizeBytes: 256_000,
      width: 600,
      height: 800,
      position: 0,
      isPrimary: true,
      purpose: "PROFILE",
      moderationStatus: "APPROVED",
      moderationReason: null,
      url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&q=80",
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(48),
    },
  ],
  intents: ["DATING", "COMMITTED_RELATIONSHIP"],
  interests: baseInterests.slice(0, 4),
  lifestyle: {
    smoking: "NEVER",
    drinking: "OCCASIONAL",
    exercise: "WEEKLY",
    diet: "OMNIVORE",
    petPreference: "LIKES_PETS",
    sleepPattern: "FLEXIBLE",
    socialEnergy: "BALANCED",
  },
  schedulePreference: {
    weekdayMask: 0b1111111,
    timeBlockMask: 0b011110,
    prefersWeekends: true,
    remoteFriendly: true,
    maxMeetupsPerWeek: 2,
    preferredLeadTimeDays: 3,
    timezone: "Asia/Kolkata",
  },
  discoveryPreference: {
    minAge: 22,
    maxAge: 40,
    maxDistanceKm: 30,
    intentFilter: ["DATING", "COMMITTED_RELATIONSHIP", "MARRIAGE_MINDED"],
    preferredGenders: ["WOMAN"],
    includeRecentlyActiveOnly: true,
    preferSameCity: true,
  },
  communicationPreference: {
    allowVoiceCalls: true,
    allowVideoCalls: true,
    allowPushMatches: true,
    allowPushMessages: true,
    allowPushCalls: true,
    allowReadReceipts: true,
  },
  completion: { isComplete: true, completedAt: hoursAgo(24), missingCriteria: [] },
  createdAt: hoursAgo(72),
  updatedAt: now(),
};

const publicProfile = (
  id: string,
  displayName: string,
  age: number,
  headline: string,
  bio: string,
  city: string,
  km: number,
  interestIdxs: number[],
  photoSeed: number,
): PublicProfileDto => ({
  userId: id,
  displayName,
  headline,
  bio,
  age,
  gender: ["Rohan", "Kabir", "Arjun", "Dev"].includes(displayName) ? "MAN" : "WOMAN",
  pronouns: ["Rohan", "Kabir", "Arjun", "Dev"].includes(displayName) ? "he/him" : "she/her",
  location: {
    city,
    region: "Telangana",
    countryCode: "IN",
    distanceKmRounded: km,
    distanceBand: km < 5 ? "LOCAL" : km < 15 ? "NEARBY" : "CITY_EDGE",
  },
  verificationStatus: "VERIFIED",
  preferredRelationshipPace: "INTENTIONAL",
  languages: ["English", "Hindi", "Telugu"],
  foodPreferences: ["Café-friendly"],
  profilePrompts: [
    {
      promptId: "ideal_sunday",
      answer: "A slow breakfast, a shaded walk and enough time to really talk.",
    },
    {
      promptId: "healthy_relationship",
      answer: "We can be honest without being unkind, especially on difficult days.",
    },
  ],
  compatibility: {
    score: 88 - photoSeed,
    reasons: ["Your relationship intentions align", "You share thoughtful weekend interests"],
    sharedInterests: interestIdxs
      .map((i) => baseInterests[i]?.displayName)
      .filter((value): value is string => Boolean(value))
      .slice(0, 3),
    scheduleOverlap: "Weekend availability overlaps in the afternoon",
  },
  sensitiveCompatibility: null,
  intents: ["DATING", "COMMITTED_RELATIONSHIP"],
  interests: interestIdxs.map((i) => baseInterests[i]).filter(Boolean),
  lifestyle: {
    smoking: "NEVER",
    drinking: "OCCASIONAL",
    exercise: "WEEKLY",
    diet: "OMNIVORE",
    petPreference: "LIKES_PETS",
    sleepPattern: "FLEXIBLE",
    socialEnergy: "BALANCED",
  },
  photos: [placeholderPhoto(photoSeed)],
});

export const fixtureDiscoveryFeed: DiscoveryFeedResponseDto = {
  items: [
    publicProfile(
      ASHA_ID,
      "Asha",
      29,
      "Watercolours, used bookstores, late-night biryani",
      "Designer by day, illustrator by night. Looking for someone who'll geek out about typography or hike up Nandi Hills before sunrise.",
      "Jubilee Hills",
      4,
      [1, 0, 6, 3],
      0,
    ),
    publicProfile(
      ROHAN_ID,
      "Rohan",
      33,
      "Trail runs, jazz on Sundays, dad jokes for free",
      "Software engineer who'd rather be outside. I run, I cook, I read too many newsletters. Open to walks, climbs, or low-key dinners.",
      "Gachibowli",
      9,
      [4, 5, 2, 7],
      1,
    ),
    publicProfile(
      MEERA_ID,
      "Meera",
      27,
      "Bookshop kid, slow mornings, second chai please",
      "I make a living writing, I make a life reading. New to Bangalore and looking for the kind of friends who suggest a Saturday plan and actually show up.",
      "Madhapur",
      12,
      [1, 0, 6],
      2,
    ),
    publicProfile(
      KABIR_ID,
      "Kabir",
      30,
      "Rock climbing, indie films, vinyl over playlists",
      "Architect, climber, vinyl collector. I'm here for slow, kind conversations and weekend climbs at Ramanagara. Big believer in showing up.",
      "Kondapur",
      6,
      [2, 6, 3, 5],
      3,
    ),
    publicProfile(
      PRIYA_ID,
      "Priya",
      28,
      "Yoga, jazz playlists, dessert before dinner",
      "Yoga teacher who likes spontaneous Sunday plans, tiny bookstores, and people who are kind to service staff.",
      "Jubilee Hills",
      7,
      [4, 2, 3, 7],
      4,
    ),
    publicProfile(
      ARJUN_ID,
      "Arjun",
      33,
      "Cyclist, home cook, ramen-map keeper",
      "Recently moved here. Looking for weekend rides, low-key dinners, and someone who takes good coffee seriously.",
      "Gachibowli",
      11,
      [3, 7, 0, 6],
      5,
    ),
    publicProfile(
      SARA_ID,
      "Sara",
      29,
      "Sunday cyclist, bread baker, terrible singer",
      "I write code, bake bread, and collect tiny cafes. Here for kind people and unhurried weekend plans.",
      "Madhapur",
      5,
      [0, 1, 2, 7],
      7,
    ),
    publicProfile(
      DEV_ID,
      "Dev",
      28,
      "Hiker, home-cook, quietly funny",
      "Weekend hiker with strong opinions about trail snacks. Cooking for one is fine, cooking for two is better.",
      "Kondapur",
      14,
      [5, 7, 2, 3],
      6,
    ),
    publicProfile(
      NADIA_ID,
      "Nadia",
      30,
      "Dancer, dessert-first, deeply curious",
      "Salsa on Tuesdays, bookshops on Saturdays. Open to dating but in no rush; good conversation matters most.",
      "Jubilee Hills",
      8,
      [2, 1, 6, 7],
      9,
    ),
  ],
  nextCursor: null,
  snapshotExpiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
  dailyLimit: 8,
  remainingToday: 0,
};

const receivedLikeFromProfile = (
  profile: PublicProfileDto,
  index: number,
  minutes: number,
): ReceivedLikePreviewDto => ({
  likeId: `fixture-like-${index}`,
  actorUserId: profile.userId,
  likedAt: minutesAgo(minutes),
  introNote:
    index === 1
      ? "Your love for quiet Sunday cafés caught my attention. I would enjoy hearing about your favourite one."
      : null,
  displayName: profile.displayName,
  age: profile.age ?? 0,
  headline: profile.headline,
  intents: profile.intents.filter((intent): intent is ReceivedLikeIntent =>
    (["FRIENDSHIP", "COMPANIONSHIP", "SHARED_INTERESTS", "RELATIONSHIP"] as const).some(
      (allowed) => allowed === intent,
    ),
  ),
  primaryPhotoUrl: profile.photos[0]?.url ?? null,
  city: profile.location.city,
  region: profile.location.region,
});

export const fixtureReceivedLikes: ReceivedLikesResponseDto = {
  items: [
    receivedLikeFromProfile(fixtureDiscoveryFeed.items[4]!, 1, 12),
    receivedLikeFromProfile(fixtureDiscoveryFeed.items[5]!, 2, 38),
    receivedLikeFromProfile(fixtureDiscoveryFeed.items[6]!, 3, 74),
    receivedLikeFromProfile(fixtureDiscoveryFeed.items[7]!, 4, 130),
    receivedLikeFromProfile(fixtureDiscoveryFeed.items[8]!, 5, 280),
  ],
  nextCursor: null,
};

const matchSummary = (
  id: string,
  partner: PublicProfileDto,
  matchedMinAgo: number,
  conversationId: string | null,
  preview: string | null,
  previewMinAgo: number | null,
): MatchSummaryDto => ({
  id,
  status: "ACTIVE",
  matchedAt: minutesAgo(matchedMinAgo),
  endedAt: null,
  endedReason: null,
  otherUser: partner,
  conversationId,
  myCommunicationSetting: {
    matchId: id,
    userId: ME_ID,
    allowVoiceCalls: true,
    allowVideoCalls: true,
    muted: false,
    updatedAt: now(),
  },
  lastMessagePreview: preview,
  lastMessageSentAt: previewMinAgo === null ? null : minutesAgo(previewMinAgo),
});

export const fixtureMatches: MatchPageDto = {
  items: [
    matchSummary(
      MATCH_MEERA,
      fixtureDiscoveryFeed.items[2]!,
      5,
      CONV_MEERA,
      "Just matched! Hi 👋",
      5,
    ),
    matchSummary(
      MATCH_ASHA,
      fixtureDiscoveryFeed.items[0]!,
      6 * 60,
      CONV_ASHA,
      "Yes please. Saturday afternoon?",
      60,
    ),
    matchSummary(
      MATCH_ROHAN,
      fixtureDiscoveryFeed.items[1]!,
      48 * 60,
      CONV_ROHAN,
      "Perfect. I'll grab us coffee after.",
      24 * 60,
    ),
    matchSummary(MATCH_KABIR, fixtureDiscoveryFeed.items[3]!, 10, null, null, null),
  ],
  nextCursor: null,
};

export const fixtureConversations = {
  items: fixtureMatches.items
    .filter((m) => m.conversationId)
    .map((m): ConversationSummaryDto => ({
      kind: "SOLO",
      duoMatchId: null,
      participants: [m.otherUser],
      readStates: [],
      id: m.conversationId!,
      matchId: m.id,
      status: "ACTIVE",
      otherUser: m.otherUser,
      lastMessageSequence: 5,
      lastMessagePreview: m.lastMessagePreview,
      lastMessageType: "TEXT",
      lastMessageSentAt: m.lastMessageSentAt,
      lastSenderId: m.otherUser.userId,
      lastReadSequence: 4,
      unreadCount: m.id === MATCH_ASHA ? 1 : 0,
      closedAt: null,
      closedReason: null,
      createdAt: m.matchedAt,
      updatedAt: m.lastMessageSentAt ?? m.matchedAt,
    })),
  nextCursor: null,
};

const fixtureDatePlan = (
  id: string,
  matchId: string,
  otherUserId: string,
  status: DatePlanDto["status"],
  title: string,
  locality: string,
  startAt: string,
  meetAgainOutcome: DatePlanDto["meetAgainOutcome"] = null,
): DatePlanDto => ({
  id,
  matchId,
  createdByUserId: ME_ID,
  status,
  proposalVersion: 1,
  title,
  description: "A relaxed public meetup with an easy time and place to review together.",
  activityType: "PUBLIC_CAFE_AND_ACTIVITY",
  proposedStartAt: startAt,
  durationMinutes: 120,
  timezone: "Asia/Kolkata",
  publicLocality: locality,
  venueName: "Selected public café",
  venuePhotoUrl: null,
  venueAddress: `${locality}, Hyderabad (public meeting point)`,
  latitude: null,
  longitude: null,
  exactVenueVisibleAt: hoursAgo(6),
  acceptedAt: status === "ACCEPTED" || status === "COMPLETED" ? hoursAgo(2) : null,
  declinedAt: null,
  cancelledAt: null,
  completedAt: status === "COMPLETED" ? hoursAgo(24) : null,
  responses: [
    { userId: ME_ID, response: "ACCEPTED", proposalVersion: 1, respondedAt: hoursAgo(4) },
    ...(status === "ACCEPTED" || status === "COMPLETED"
      ? [
          {
            userId: otherUserId,
            response: "ACCEPTED" as const,
            proposalVersion: 1,
            respondedAt: hoursAgo(2),
          },
        ]
      : []),
  ],
  mySafetyStatus: status === "COMPLETED" ? "OKAY" : null,
  myPostDateResponseSubmitted: status === "COMPLETED",
  meetAgainOutcome: status === "COMPLETED" ? meetAgainOutcome : null,
  createdAt: hoursAgo(6),
  updatedAt: hoursAgo(2),
});

export const fixtureDatePlans: DatePlanPageDto = {
  items: [
    fixtureDatePlan(
      "dddd1111-1111-1111-1111-111111111111",
      MATCH_ASHA,
      ASHA_ID,
      "PROPOSED",
      "Book browsing and chai",
      "Jubilee Hills",
      hoursFromNow(72),
    ),
    fixtureDatePlan(
      "dddd2222-2222-2222-2222-222222222222",
      MATCH_ROHAN,
      ROHAN_ID,
      "ACCEPTED",
      "Public art and coffee",
      "Madhapur",
      hoursFromNow(24),
    ),
    fixtureDatePlan(
      "dddd3333-3333-3333-3333-333333333333",
      MATCH_MEERA,
      MEERA_ID,
      "COMPLETED",
      "Breakfast conversation",
      "Gachibowli",
      hoursAgo(30),
      "MUTUAL",
    ),
    fixtureDatePlan(
      "dddd4444-4444-4444-4444-444444444444",
      MATCH_KABIR,
      KABIR_ID,
      "COMPLETED",
      "Weekend heritage walk",
      "Kondapur",
      hoursAgo(72),
      null,
    ),
  ],
  nextCursor: null,
};

const message = (
  id: string,
  conversationId: string,
  senderId: string,
  sequence: number,
  body: string,
  minAgo: number,
): MessageDto => ({
  id,
  conversationId,
  senderId,
  sequence,
  clientMessageId: null,
  type: "TEXT",
  textBody: body,
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
  createdAt: minutesAgo(minAgo),
  updatedAt: minutesAgo(minAgo),
});

export const fixtureMessagesByConversation: Record<string, MessagePageDto> = {
  [CONV_ASHA]: {
    items: [
      message(
        "m-a-1",
        CONV_ASHA,
        ASHA_ID,
        1,
        "Hey! Loved your bio — what are you reading right now?",
        135,
      ),
      message("m-a-2", CONV_ASHA, ME_ID, 2, "Hi Asha! Just started 'Pachinko'. You?", 125),
      message(
        "m-a-3",
        CONV_ASHA,
        ASHA_ID,
        3,
        "Beautiful book. I'm halfway through 'Klara and the Sun' — can't put it down.",
        110,
      ),
      message(
        "m-a-4",
        CONV_ASHA,
        ME_ID,
        4,
        "Adding it to my list. There's a bookshop in Jubilee Hills — keen to check it out together?",
        90,
      ),
      message("m-a-5", CONV_ASHA, ASHA_ID, 5, "Yes please. Saturday afternoon?", 60),
    ],
    nextCursor: null,
  },
  [CONV_ROHAN]: {
    items: [
      message(
        "m-r-1",
        CONV_ROHAN,
        ME_ID,
        1,
        "Hey Rohan — KBR Park run this Sunday? Easy 5k.",
        26 * 60,
      ),
      message("m-r-2", CONV_ROHAN, ROHAN_ID, 2, "I'm in. 6:30am okay?", 25 * 60),
      message("m-r-3", CONV_ROHAN, ME_ID, 3, "Perfect. I'll grab us coffee after.", 24 * 60),
    ],
    nextCursor: null,
  },
  [CONV_MEERA]: {
    items: [message("m-m-1", CONV_MEERA, MEERA_ID, 1, "Just matched! Hi 👋", 5)],
    nextCursor: null,
  },
};

export const fixtureNotifications: NotificationPageDto = {
  items: [
    {
      id: "n-date-1",
      type: "DATE_ACCEPTED",
      channel: "IN_APP",
      title: "Your date is confirmed",
      body: "Public art and coffee is confirmed. Exact venue details are now visible.",
      data: { matchId: MATCH_ROHAN, datePlanId: "dddd2222-2222-2222-2222-222222222222" },
      actor: { userId: ROHAN_ID, displayName: "Rohan" },
      status: "PENDING",
      readAt: null,
      sentAt: minutesAgo(20),
      createdAt: minutesAgo(20),
    } satisfies NotificationDto,
    {
      id: "n-1",
      type: "NEW_MATCH",
      channel: "IN_APP",
      title: "You matched",
      body: "You and Meera just matched. Say hi when you're ready.",
      data: { matchId: MATCH_MEERA, conversationId: CONV_MEERA },
      actor: { userId: MEERA_ID, displayName: "Meera" },
      status: "PENDING",
      readAt: null,
      sentAt: minutesAgo(5),
      createdAt: minutesAgo(5),
    } satisfies NotificationDto,
    {
      id: "n-2",
      type: "NEW_MESSAGE",
      channel: "IN_APP",
      title: "Asha sent a message",
      body: "Yes please. Saturday afternoon?",
      data: { conversationId: CONV_ASHA, matchId: MATCH_ASHA },
      actor: { userId: ASHA_ID, displayName: "Asha" },
      status: "PENDING",
      readAt: null,
      sentAt: minutesAgo(60),
      createdAt: minutesAgo(60),
    } satisfies NotificationDto,
    {
      id: "n-3",
      type: "MISSED_CALL",
      channel: "IN_APP",
      title: "Missed call from Rohan",
      body: "Voice call · ring no answer",
      data: { matchId: MATCH_ROHAN },
      actor: { userId: ROHAN_ID, displayName: "Rohan" },
      status: "READ",
      readAt: hoursAgo(8),
      sentAt: hoursAgo(8),
      createdAt: hoursAgo(8),
    } satisfies NotificationDto,
  ],
  nextCursor: null,
};

export const fixtureSessions: SessionPageDto = {
  items: [
    {
      id: "s-1",
      deviceId: "dev-1",
      deviceName: "iPhone 15",
      platform: "IOS",
      appVersion: "0.1.0",
      lastSeenAt: now(),
      createdAt: hoursAgo(72),
      revokedAt: null,
      isCurrent: true,
    },
    {
      id: "s-2",
      deviceId: "dev-2",
      deviceName: "Pixel 8",
      platform: "ANDROID",
      appVersion: "0.1.0",
      lastSeenAt: hoursAgo(36),
      createdAt: hoursAgo(120),
      revokedAt: null,
      isCurrent: false,
    },
  ],
  nextCursor: null,
};

export const fixtureCall: CallSessionDto = {
  id: "call-1",
  matchId: MATCH_ASHA,
  conversationId: CONV_ASHA,
  initiatorUserId: ASHA_ID,
  receiverUserId: ME_ID,
  callType: "VOICE",
  status: "RINGING",
  signalingVersion: 1,
  ringStartedAt: now(),
  acceptedAt: null,
  connectedAt: null,
  endedAt: null,
  expiresAt: minutesAgo(-1),
  endReason: null,
  createdAt: now(),
  updatedAt: now(),
};

export const ids = {
  ME_ID,
  MATCH_ASHA,
  MATCH_ROHAN,
  MATCH_MEERA,
  MATCH_KABIR,
  CONV_ASHA,
  CONV_ROHAN,
  CONV_MEERA,
};
