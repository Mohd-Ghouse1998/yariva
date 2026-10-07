/**
 * Aroha demo data seed.
 *
 * Run with:   npm run prisma:seed:demo
 *
 * Creates a primary demo user (chinmoy@aroha.dev / Password123!) plus four
 * matched profiles, conversations with realistic messages, and a few
 * notifications. Safe to re-run — every record is upserted by a stable key
 * (email or composite id pair) so the seed is idempotent.
 *
 * Demo photos use the storage service's explicit "external" sentinel so the
 * seeded mobile experience renders deterministic portrait URLs without
 * requiring fake objects in the private upload bucket.
 */
import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { encodeGeohash } from "../src/common/utils/geohash.util";

export interface DemoUserInput {
  email: string;
  displayName: string;
  headline: string;
  bio: string;
  age: number;
  gender:
    | "WOMAN"
    | "MAN"
    | "NON_BINARY"
    | "TRANS_WOMAN"
    | "TRANS_MAN"
    | "AGENDER"
    | "OTHER"
    | "PREFER_NOT_TO_SAY";
  pronouns: string;
  city: string;
  region: string;
  countryCode: string;
  lat: number;
  lng: number;
  intents: Array<
    | "FRIENDSHIP"
    | "COMPANIONSHIP"
    | "SHARED_INTERESTS"
    | "RELATIONSHIP"
    | "DATING"
    | "COMMITTED_RELATIONSHIP"
    | "MARRIAGE_MINDED"
  >;
  interestSlugs: string[];
  /** Optional assets for additive local seeds; legacy URLs remain unchanged. */
  photoUrls?: readonly string[];
  verificationStatus?: "UNVERIFIED" | "VERIFIED";
}

const DEFAULT_PASSWORD = "Password123!";

const DEMO_FEATURE_FLAGS = [
  { key: "discovery.v1", description: "Enable Phase 1 discovery feed" },
  { key: "calls.v1", description: "Enable Phase 1 voice and video calls" },
  {
    key: "scenes.v1",
    description: "Enable Scene publishing and intent-based discovery",
  },
  {
    key: "wingman.v1",
    description: "Enable private Wingman parties and invitations",
  },
] as const;

const DEMO_PHOTO_URLS: Record<string, readonly [string, string]> = {
  "chinmoy@aroha.dev": [
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
  ],
  "asha@aroha.dev": [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
  ],
  "rohan@aroha.dev": [
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
  ],
  "meera@aroha.dev": [
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
  ],
  "kabir@aroha.dev": [
    "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=800&q=80",
    "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=800&q=80",
  ],
  "nandini@aroha.dev": [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
  ],
  "sana@aroha.dev": [
    "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
  ],
};

const PRIMARY_USER: DemoUserInput = {
  email: "chinmoy@aroha.dev",
  displayName: "Chinmoy",
  headline: "Slow coffee · Long walks · Building Aroha",
  bio: "Founder, friend, occasional cyclist. Looking to meet people who care about the same small things — books, kind conversation, weekend trails.",
  age: 31,
  gender: "MAN",
  pronouns: "he/him",
  city: "Hyderabad",
  region: "Telangana",
  countryCode: "IN",
  lat: 17.385,
  lng: 78.4867,
  intents: ["DATING", "COMMITTED_RELATIONSHIP"],
  interestSlugs: ["coffee", "books", "music", "travel"],
};

const OTHER_USERS: DemoUserInput[] = [
  {
    email: "asha@aroha.dev",
    displayName: "Asha",
    headline: "Watercolours, used bookstores, late-night biryani",
    bio: "Designer by day, illustrator by night. Looking for someone who'll geek out about typography or take a quiet Sunday walk around KBR Park.",
    age: 29,
    gender: "WOMAN",
    pronouns: "she/her",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    lat: 17.4318,
    lng: 78.4071,
    intents: ["DATING", "COMMITTED_RELATIONSHIP"],
    interestSlugs: ["books", "coffee", "movies", "travel"],
  },
  {
    email: "rohan@aroha.dev",
    displayName: "Rohan",
    headline: "Trail runs, jazz on Sundays, dad jokes for free",
    bio: "Software engineer who'd rather be outside. I run, I cook, I read too many newsletters. Open to walks, climbs, or low-key dinners.",
    age: 33,
    gender: "MAN",
    pronouns: "he/him",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    lat: 17.4401,
    lng: 78.3489,
    intents: ["DATING", "MARRIAGE_MINDED"],
    interestSlugs: ["fitness", "hiking", "music", "cooking"],
  },
  {
    email: "meera@aroha.dev",
    displayName: "Meera",
    headline: "Bookshop kid, slow mornings, second chai please",
    bio: "I make a living writing and a life reading. New to Hyderabad and looking for someone who suggests a thoughtful Saturday plan and actually shows up.",
    age: 27,
    gender: "WOMAN",
    pronouns: "she/her",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    lat: 17.4486,
    lng: 78.3908,
    intents: ["DATING", "COMMITTED_RELATIONSHIP"],
    interestSlugs: ["books", "coffee", "movies"],
  },
  {
    email: "kabir@aroha.dev",
    displayName: "Kabir",
    headline: "Rock climbing, indie films, vinyl over playlists",
    bio: "Architect, climber, vinyl collector. I'm here for slow, kind conversations and weekend plans around Hyderabad. Big believer in showing up.",
    age: 30,
    gender: "MAN",
    pronouns: "he/him",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    lat: 17.4126,
    lng: 78.4482,
    intents: ["DATING", "MARRIAGE_MINDED"],
    interestSlugs: ["music", "movies", "travel", "hiking"],
  },
  {
    email: "nandini@aroha.dev",
    displayName: "Nandini",
    headline: "Classical dance, design walks, filter coffee",
    bio: "Product researcher and Kuchipudi learner. I like museum afternoons, curious questions, and making plans that leave room for serendipity.",
    age: 28,
    gender: "WOMAN",
    pronouns: "she/her",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    lat: 17.4239,
    lng: 78.4738,
    intents: ["DATING", "COMMITTED_RELATIONSHIP"],
    interestSlugs: ["coffee", "music", "travel", "movies"],
  },
  {
    email: "sana@aroha.dev",
    displayName: "Sana",
    headline: "Community kitchens, poetry, sunrise walks",
    bio: "Public-health researcher who collects recipes and poems. Looking for a warm, intentional connection built through honest conversation.",
    age: 30,
    gender: "WOMAN",
    pronouns: "she/her",
    city: "Hyderabad",
    region: "Telangana",
    countryCode: "IN",
    lat: 17.4065,
    lng: 78.4772,
    intents: ["DATING", "COMMITTED_RELATIONSHIP"],
    interestSlugs: ["cooking", "books", "coffee", "travel"],
  },
];

interface ConversationSeed {
  partnerEmail: string;
  status: "ACTIVE" | "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
  messages: Array<{
    fromPartner: boolean;
    body: string;
    minutesAgo: number;
  }>;
}

const CONVERSATION_SEEDS: ConversationSeed[] = [
  {
    partnerEmail: "asha@aroha.dev",
    status: "ACTIVE",
    messages: [
      {
        fromPartner: true,
        body: "Hey! Loved your bio — what are you reading right now?",
        minutesAgo: 2 * 60 + 15,
      },
      {
        fromPartner: false,
        body: "Hi Asha! Just started 'Pachinko'. You?",
        minutesAgo: 2 * 60 + 5,
      },
      {
        fromPartner: true,
        body: "Beautiful book. I'm halfway through 'Klara and the Sun' — can't put it down.",
        minutesAgo: 110,
      },
      {
        fromPartner: false,
        body: "Adding it to my list. There’s a bookshop in Jubilee Hills — keen to check it out together?",
        minutesAgo: 90,
      },
      {
        fromPartner: true,
        body: "Yes please. Saturday afternoon?",
        minutesAgo: 60,
      },
    ],
  },
  {
    partnerEmail: "rohan@aroha.dev",
    status: "ACTIVE",
    messages: [
      {
        fromPartner: false,
        body: "Hey Rohan — KBR Park run this Sunday? Easy 5k.",
        minutesAgo: 26 * 60,
      },
      { fromPartner: true, body: "I'm in. 6:30am okay?", minutesAgo: 25 * 60 },
      {
        fromPartner: false,
        body: "Perfect. I'll grab us coffee after.",
        minutesAgo: 24 * 60,
      },
    ],
  },
  {
    partnerEmail: "meera@aroha.dev",
    status: "ACTIVE",
    messages: [
      { fromPartner: true, body: "Just matched! Hi 👋", minutesAgo: 5 },
    ],
  },
];

export async function ensureUser(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: DemoUserInput,
): Promise<string> {
  const passwordHash = await hash(DEFAULT_PASSWORD, 12);
  const dob = new Date(
    Date.UTC(new Date().getUTCFullYear() - input.age, 5, 15),
  );
  const geohash = encodeGeohash(input.lat, input.lng);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash,
      status: "ACTIVE",
      lastActiveAt: new Date(),
    },
    update: { lastActiveAt: new Date() },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: input.displayName,
      headline: input.headline,
      bio: input.bio,
      dateOfBirth: dob,
      gender: input.gender,
      pronouns: input.pronouns,
      city: input.city,
      region: input.region,
      countryCode: input.countryCode,
      locationLat: input.lat,
      locationLng: input.lng,
      locationUpdatedAt: new Date(),
      locationGeohash: geohash,
      verificationStatus: input.verificationStatus ?? "VERIFIED",
      preferredRelationshipPace: "SLOW_AND_STEADY",
      languages: ["Telugu", "Hindi", "English"],
      foodPreferences: ["Café food", "Hyderabadi", "Vegetarian-friendly"],
      relocationOpenness: "Open to discussing within India",
      careerPriority: "Ambitious with room for relationships",
      familyInvolvementComfort: "Comfortable after trust develops",
      marriageTimeline: "Open to a clear timeline together",
      childrenPreference: "Open to discussing",
      religionSpirituality: "Personal and respectful",
      shareSensitiveCompatibility: true,
      promptResponses: [
        {
          promptId: "ideal_sunday",
          answer:
            "A slow breakfast, a long walk, and one plan worth looking forward to.",
        },
        {
          promptId: "learn_together",
          answer:
            "A recipe neither of us has tried, without pretending the first attempt will be perfect.",
        },
        {
          promptId: "healthy_relationship",
          answer:
            "Both people can be direct, kind, and still keep their own lives.",
        },
      ],
      isComplete: true,
      completedAt: new Date(),
    },
    update: {
      displayName: input.displayName,
      headline: input.headline,
      bio: input.bio,
      dateOfBirth: dob,
      gender: input.gender,
      pronouns: input.pronouns,
      city: input.city,
      region: input.region,
      countryCode: input.countryCode,
      locationLat: input.lat,
      locationLng: input.lng,
      locationUpdatedAt: new Date(),
      locationGeohash: geohash,
      verificationStatus: input.verificationStatus ?? "VERIFIED",
      preferredRelationshipPace: "SLOW_AND_STEADY",
      languages: ["Telugu", "Hindi", "English"],
      foodPreferences: ["Café food", "Hyderabadi", "Vegetarian-friendly"],
      relocationOpenness: "Open to discussing within India",
      careerPriority: "Ambitious with room for relationships",
      familyInvolvementComfort: "Comfortable after trust develops",
      marriageTimeline: "Open to a clear timeline together",
      childrenPreference: "Open to discussing",
      religionSpirituality: "Personal and respectful",
      shareSensitiveCompatibility: true,
      promptResponses: [
        {
          promptId: "ideal_sunday",
          answer:
            "A slow breakfast, a long walk, and one plan worth looking forward to.",
        },
        {
          promptId: "learn_together",
          answer:
            "A recipe neither of us has tried, without pretending the first attempt will be perfect.",
        },
        {
          promptId: "healthy_relationship",
          answer:
            "Both people can be direct, kind, and still keep their own lives.",
        },
      ],
      isComplete: true,
      completedAt: new Date(),
    },
  });

  // Intents
  await prisma.userIntent.deleteMany({ where: { userId: user.id } });
  await prisma.userIntent.createMany({
    data: input.intents.map((intent) => ({ userId: user.id, intent })),
  });

  // Interests
  const interestRecords = await prisma.interestTag.findMany({
    where: { slug: { in: input.interestSlugs } },
  });
  await prisma.userInterest.deleteMany({ where: { userId: user.id } });
  if (interestRecords.length > 0) {
    await prisma.userInterest.createMany({
      data: interestRecords.map((tag) => ({
        userId: user.id,
        interestTagId: tag.id,
      })),
      skipDuplicates: true,
    });
  }

  // Lifestyle / schedule / preferences (defaults are fine; just ensure they exist).
  await prisma.userLifestyle.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      smoking: "NEVER",
      drinking: "OCCASIONAL",
      exercise: "WEEKLY",
      diet: "OMNIVORE",
      petPreference: "LIKES_PETS",
      sleepPattern: "FLEXIBLE",
      socialEnergy: "BALANCED",
    },
    update: {},
  });
  await prisma.userSchedulePreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      weekdayMask: 0b1111111,
      timeBlockMask: 0b011110,
      prefersWeekends: true,
      remoteFriendly: true,
      maxMeetupsPerWeek: 2,
      preferredLeadTimeDays: 3,
      timezone: "Asia/Kolkata",
    },
    update: {},
  });
  await prisma.userDiscoveryPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      minAge: 22,
      maxAge: 40,
      maxDistanceKm: 30,
      intentFilter: input.intents,
      preferredGenders: input.gender === "MAN" ? ["WOMAN"] : ["MAN"],
      includeRecentlyActiveOnly: true,
      preferSameCity: true,
    },
    update: {},
  });
  await prisma.userCommunicationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      allowVoiceCalls: true,
      allowVideoCalls: true,
      allowPushMatches: true,
      allowPushMessages: true,
      allowPushCalls: true,
      allowReadReceipts: true,
    },
    update: {},
  });

  // Approved primary photo + secondary photo. Existing legacy demo rows are
  // updated in place so re-running this seed also repairs older local data.
  const existingPhotos = await prisma.profilePhoto.findMany({
    where: { userId: user.id },
  });
  const photoUrls = input.photoUrls ?? DEMO_PHOTO_URLS[input.email];
  if (!photoUrls || photoUrls.length === 0) {
    throw new Error(`Missing demo photo URLs for ${input.email}`);
  }
  if (existingPhotos.length >= photoUrls.length) {
    const ordered = existingPhotos.sort(
      (left, right) => left.position - right.position,
    );
    await Promise.all(
      photoUrls.map((url, position) =>
        prisma.profilePhoto.update({
          where: { id: ordered[position]!.id },
          data: {
            objectKey: url,
            bucket: "external",
            position,
            isPrimary: position === 0,
            moderationStatus: "APPROVED",
            moderationReason: null,
            approvedAt: new Date(),
            rejectedAt: null,
            deletedAt: null,
          },
        }),
      ),
    );
  } else {
    await prisma.profilePhoto.deleteMany({ where: { userId: user.id } });
    await prisma.profilePhoto.createMany({
      data: photoUrls.map((url, position) => ({
        userId: user.id,
        objectKey: url,
        bucket: "external",
        mimeType: "image/jpeg",
        sizeBytes: 256_000,
        width: 800,
        height: 1066,
        position,
        isPrimary: position === 0,
        moderationStatus: "APPROVED",
        approvedAt: new Date(),
      })),
    });
  }

  return user.id;
}

async function ensureMatch(
  prisma: PrismaClient,
  primaryId: string,
  partnerId: string,
): Promise<string> {
  const [low, high] =
    primaryId < partnerId ? [primaryId, partnerId] : [partnerId, primaryId];

  // Mark the underlying likes as MATCHED so the analytic surface is consistent.
  await prisma.like.upsert({
    where: { actorId_targetId: { actorId: primaryId, targetId: partnerId } },
    create: {
      actorId: primaryId,
      targetId: partnerId,
      status: "MATCHED",
      matchedAt: new Date(),
    },
    update: { status: "MATCHED", matchedAt: new Date() },
  });
  await prisma.like.upsert({
    where: { actorId_targetId: { actorId: partnerId, targetId: primaryId } },
    create: {
      actorId: partnerId,
      targetId: primaryId,
      status: "MATCHED",
      matchedAt: new Date(),
    },
    update: { status: "MATCHED", matchedAt: new Date() },
  });

  const match = await prisma.match.upsert({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    create: { userLowId: low, userHighId: high, status: "ACTIVE" },
    update: {
      status: "ACTIVE",
      endedAt: null,
      endedReason: null,
      endedByUserId: null,
    },
  });

  for (const userId of [primaryId, partnerId]) {
    await prisma.matchCommunicationSetting.upsert({
      where: { matchId_userId: { matchId: match.id, userId } },
      create: {
        matchId: match.id,
        userId,
        allowVoiceCalls: true,
        allowVideoCalls: true,
        muted: false,
      },
      update: {},
    });
  }

  return match.id;
}

async function ensureConversation(
  prisma: PrismaClient,
  matchId: string,
  primaryId: string,
  partnerId: string,
  seed: ConversationSeed,
): Promise<void> {
  const existing = await prisma.conversation.findUnique({ where: { matchId } });
  const conversation = existing
    ? await prisma.conversation.update({
        where: { id: existing.id },
        data: { status: seed.status },
      })
    : await prisma.conversation.create({
        data: { matchId, status: seed.status },
      });

  // Wipe any prior demo messages so re-seeding is deterministic.
  await prisma.message.deleteMany({
    where: { conversationId: conversation.id },
  });

  let sequence = 0;
  let lastPreview: string | null = null;
  let lastSentAt: Date | null = null;
  let lastSenderId: string | null = null;

  for (const m of seed.messages) {
    sequence += 1;
    const senderId = m.fromPartner ? partnerId : primaryId;
    const sentAt = new Date(Date.now() - m.minutesAgo * 60_000);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        sequence,
        type: "TEXT",
        textBody: m.body,
        status: "ACTIVE",
        createdAt: sentAt,
        updatedAt: sentAt,
      },
    });
    lastPreview = m.body.slice(0, 160);
    lastSentAt = sentAt;
    lastSenderId = senderId;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageSequence: sequence,
      lastMessagePreview: lastPreview,
      lastMessageType: lastPreview ? "TEXT" : null,
      lastMessageSentAt: lastSentAt,
      lastSenderId: lastSenderId,
    },
  });

  // Mark the primary user as having read up to last partner message - 1
  // so unread badges actually appear in the demo.
  const lastPartnerMessage = [...seed.messages]
    .reverse()
    .find((m) => m.fromPartner);
  if (lastPartnerMessage) {
    const partnerSeq = seed.messages.filter(
      (m, i) =>
        m.fromPartner && i <= seed.messages.lastIndexOf(lastPartnerMessage),
    ).length;
    void partnerSeq;
  }
  // Simpler: primary user has read everything except the last message if it was the partner's.
  const lastIsPartner =
    seed.messages[seed.messages.length - 1]?.fromPartner === true;
  const upTo = lastIsPartner ? Math.max(0, sequence - 1) : sequence;
  await prisma.conversationRead
    .upsert({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: primaryId,
        },
      } as never,
      create: {
        conversationId: conversation.id,
        userId: primaryId,
        lastReadSequence: upTo,
      },
      update: { lastReadSequence: upTo },
    })
    .catch(async () => {
      const existingRead = await prisma.conversationRead.findFirst({
        where: { conversationId: conversation.id, userId: primaryId },
      });
      if (existingRead) {
        await prisma.conversationRead.update({
          where: { id: existingRead.id },
          data: { lastReadSequence: upTo },
        });
      } else {
        await prisma.conversationRead.create({
          data: {
            conversationId: conversation.id,
            userId: primaryId,
            lastReadSequence: upTo,
          },
        });
      }
    });
  await prisma.conversationRead
    .upsert({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: partnerId,
        },
      } as never,
      create: {
        conversationId: conversation.id,
        userId: partnerId,
        lastReadSequence: sequence,
      },
      update: { lastReadSequence: sequence },
    })
    .catch(async () => {
      const existingRead = await prisma.conversationRead.findFirst({
        where: { conversationId: conversation.id, userId: partnerId },
      });
      if (existingRead) {
        await prisma.conversationRead.update({
          where: { id: existingRead.id },
          data: { lastReadSequence: sequence },
        });
      } else {
        await prisma.conversationRead.create({
          data: {
            conversationId: conversation.id,
            userId: partnerId,
            lastReadSequence: sequence,
          },
        });
      }
    });
}

async function ensureDatePlan(input: {
  prisma: PrismaClient;
  matchId: string;
  primaryId: string;
  partnerId: string;
  key: string;
  title: string;
  locality: string;
  status: "PROPOSED" | "ACCEPTED" | "COMPLETED";
  startsInHours: number;
  meetAgainOutcome?: "MUTUAL" | "NON_MUTUAL";
}): Promise<string> {
  const accepted = input.status === "ACCEPTED" || input.status === "COMPLETED";
  const now = new Date();
  const proposedStartAt = new Date(
    Date.now() + input.startsInHours * 60 * 60_000,
  );
  const plan = await input.prisma.datePlan.upsert({
    where: {
      matchId_createdByUserId_idempotencyKey: {
        matchId: input.matchId,
        createdByUserId: input.primaryId,
        idempotencyKey: input.key,
      },
    },
    create: {
      matchId: input.matchId,
      createdByUserId: input.primaryId,
      idempotencyKey: input.key,
      status: input.status,
      proposalVersion: 1,
      title: input.title,
      description:
        "A relaxed public plan chosen around shared interests and overlapping availability.",
      activityType: "PUBLIC_CAFE_AND_ACTIVITY",
      proposedStartAt,
      durationMinutes: 120,
      timezone: "Asia/Kolkata",
      publicLocality: input.locality,
      venueName: "Selected public café",
      venueAddress: `${input.locality}, Hyderabad — public meeting point`,
      estimatedCostMin: 400,
      estimatedCostMax: 1000,
      currency: "INR",
      acceptedAt: accepted ? now : null,
      exactVenueVisibleAt: accepted ? now : null,
      completedAt: input.status === "COMPLETED" ? now : null,
    },
    update: {
      status: input.status,
      title: input.title,
      proposedStartAt,
      publicLocality: input.locality,
      acceptedAt: accepted ? now : null,
      exactVenueVisibleAt: accepted ? now : null,
      completedAt: input.status === "COMPLETED" ? now : null,
      declinedAt: null,
      cancelledAt: null,
    },
  });

  await input.prisma.datePlanResponse.deleteMany({
    where: { datePlanId: plan.id },
  });
  await input.prisma.datePlanResponse.createMany({
    data: [
      {
        datePlanId: plan.id,
        userId: input.primaryId,
        proposalVersion: 1,
        response: "ACCEPTED",
      },
      ...(accepted
        ? [
            {
              datePlanId: plan.id,
              userId: input.partnerId,
              proposalVersion: 1,
              response: "ACCEPTED" as const,
            },
          ]
        : []),
    ],
  });

  await input.prisma.postDateCheckIn.deleteMany({
    where: { datePlanId: plan.id },
  });
  if (input.status === "COMPLETED") {
    await input.prisma.postDateCheckIn.createMany({
      data: [input.primaryId, input.partnerId].map((userId, index) => ({
        datePlanId: plan.id,
        userId,
        safetyStatus: "OKAY",
        wantsToMeetAgain:
          input.meetAgainOutcome === "NON_MUTUAL" ? index === 0 : true,
        safetySubmittedAt: now,
        postDateSubmittedAt: now,
        submittedAt: now,
      })),
    });
  }
  return plan.id;
}

async function seedNotifications(
  prisma: PrismaClient,
  primaryId: string,
  partners: Array<{
    id: string;
    displayName: string;
    matchId: string;
    conversationId: string | null;
  }>,
): Promise<void> {
  for (const partner of partners) {
    await prisma.notification.upsert({
      where: { dedupeKey: `demo:new-match:${partner.matchId}` },
      create: {
        userId: primaryId,
        actorUserId: partner.id,
        type: "NEW_MATCH",
        channel: "IN_APP",
        title: "You matched",
        body: `You and ${partner.displayName} just matched. Say hi when you're ready.`,
        data: {
          matchId: partner.matchId,
          conversationId: partner.conversationId,
        },
        status: "READ",
        readAt: new Date(),
        sentAt: new Date(),
        dedupeKey: `demo:new-match:${partner.matchId}`,
      },
      update: {},
    });
    if (partner.conversationId) {
      await prisma.notification.upsert({
        where: { dedupeKey: `demo:new-message:${partner.conversationId}` },
        create: {
          userId: primaryId,
          actorUserId: partner.id,
          type: "NEW_MESSAGE",
          channel: "IN_APP",
          title: `Message from ${partner.displayName}`,
          body: "You have a new message.",
          data: { conversationId: partner.conversationId },
          status: "PENDING",
          sentAt: new Date(),
          dedupeKey: `demo:new-message:${partner.conversationId}`,
        },
        update: {},
      });
    }
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    console.log("→ Seeding interest catalog and feature flags (idempotent)...");
    // Make sure the foundational interests exist (mirrors prisma/seed.ts).
    const baseTags: ReadonlyArray<readonly [string, string, string]> = [
      ["coffee", "Coffee", "food"],
      ["hiking", "Hiking", "outdoors"],
      ["books", "Books", "culture"],
      ["music", "Music", "culture"],
      ["travel", "Travel", "lifestyle"],
      ["fitness", "Fitness", "wellness"],
      ["movies", "Movies", "culture"],
      ["cooking", "Cooking", "food"],
    ];
    for (const [slug, displayName, category] of baseTags) {
      await prisma.interestTag.upsert({
        where: { slug },
        create: { slug, displayName, category },
        update: { displayName, category, isActive: true },
      });
    }

    // Database migrations create rollout-controlled features disabled by
    // default. A local demo seed must explicitly opt into the product surface
    // it is intended to demonstrate, otherwise mobile panels disappear even
    // though their UI and API implementations are present.
    for (const flag of DEMO_FEATURE_FLAGS) {
      await prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: {
          key: flag.key,
          description: flag.description,
          scope: "GLOBAL",
          enabled: true,
          rolloutPercentage: null,
          variant: null,
          config: {},
          allowlistUserIds: [],
        },
        update: {
          description: flag.description,
          scope: "GLOBAL",
          enabled: true,
          deletedAt: null,
        },
      });
    }

    console.log(
      "→ Seeding visibly synthetic reviewed venues for local development…",
    );
    const reviewedAt = new Date();
    const syntheticVenues = [
      {
        id: "10000000-0000-4000-8000-000000000001",
        name: "Yariva Test Venue — Jubilee Studio",
        publicLocality: "Jubilee Hills",
        latitude: 17.4319,
        longitude: 78.407,
        category: "ACTIVITY" as const,
        operationalStatus: "OPEN" as const,
        priceMinPerPerson: 300,
        priceMaxPerPerson: 700,
        atmosphereTags: ["CALM", "CREATIVE"],
        rating: 4.7,
        ratingCount: 286,
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        name: "Yariva Test Venue — Madhapur Commons",
        publicLocality: "Madhapur",
        latitude: 17.4483,
        longitude: 78.3915,
        category: "CAFE" as const,
        operationalStatus: "UNKNOWN" as const,
        priceMinPerPerson: null,
        priceMaxPerPerson: null,
        atmosphereTags: ["PLAYFUL", "FOOD_AND_CONVERSATION"],
        rating: 4.8,
        ratingCount: 514,
      },
      {
        id: "10000000-0000-4000-8000-000000000003",
        name: "Yariva Test Venue — Banjara Gallery",
        publicLocality: "Banjara Hills",
        latitude: 17.4156,
        longitude: 78.4347,
        category: "ACTIVITY" as const,
        operationalStatus: "CLOSED" as const,
        priceMinPerPerson: 200,
        priceMaxPerPerson: 500,
        atmosphereTags: ["CREATIVE"],
        rating: 4.5,
        ratingCount: 173,
      },
      {
        id: "10000000-0000-4000-8000-000000000004",
        name: "Yariva Test Venue — Hitec Table",
        publicLocality: "Hitec City",
        latitude: 17.4435,
        longitude: 78.3772,
        category: "RESTAURANT" as const,
        operationalStatus: "OPEN" as const,
        priceMinPerPerson: 500,
        priceMaxPerPerson: 900,
        atmosphereTags: ["FOOD_AND_CONVERSATION", "CALM"],
        rating: 4.9,
        ratingCount: 641,
      },
      {
        id: "10000000-0000-4000-8000-000000000005",
        name: "Yariva Test Venue — Central Coffee Room",
        publicLocality: "Abids",
        latitude: 17.393,
        longitude: 78.474,
        category: "CAFE" as const,
        operationalStatus: "OPEN" as const,
        priceMinPerPerson: 250,
        priceMaxPerPerson: 550,
        atmosphereTags: ["CALM", "FOOD_AND_CONVERSATION"],
        rating: 4.6,
        ratingCount: 802,
      },
      {
        id: "10000000-0000-4000-8000-000000000006",
        name: "Yariva Test Venue — Koti Social Table",
        publicLocality: "Koti",
        latitude: 17.3858,
        longitude: 78.4862,
        category: "RESTAURANT" as const,
        operationalStatus: "OPEN" as const,
        priceMinPerPerson: 400,
        priceMaxPerPerson: 800,
        atmosphereTags: ["PLAYFUL", "FOOD_AND_CONVERSATION"],
        rating: 4.7,
        ratingCount: 925,
      },
    ];
    for (const venue of syntheticVenues) {
      const data = {
        name: venue.name,
        address: "Synthetic address for local development only",
        publicLocality: venue.publicLocality,
        city: "Hyderabad",
        countryCode: "IN",
        latitude: venue.latitude,
        longitude: venue.longitude,
        reviewStatus: "REVIEWED" as const,
        reviewSource: "YARIVA_SYNTHETIC_FIXTURE",
        reviewedAt,
        operationalStatus: venue.operationalStatus,
        category: venue.category,
        priceMinPerPerson: venue.priceMinPerPerson,
        priceMaxPerPerson: venue.priceMaxPerPerson,
        currency: "INR",
        rating: venue.rating,
        ratingCount: venue.ratingCount,
        ratingSource: "YARIVA_SYNTHETIC_FIXTURE",
        accessibilityFacts: [],
        atmosphereTags: venue.atmosphereTags,
        isSynthetic: true,
        deletedAt: null,
      };
      await prisma.reviewedVenue.upsert({
        where: { id: venue.id },
        create: { id: venue.id, ...data },
        update: data,
      });
    }

    console.log(
      `→ Creating primary demo user: ${PRIMARY_USER.email} (password: ${DEFAULT_PASSWORD})`,
    );
    const primaryId = await ensureUser(prisma, PRIMARY_USER);

    console.log(`→ Creating ${OTHER_USERS.length} partner users…`);
    const partnerIds = new Map<string, { id: string; displayName: string }>();
    for (const u of OTHER_USERS) {
      const id = await ensureUser(prisma, u);
      partnerIds.set(u.email, { id, displayName: u.displayName });
    }

    // Local demo relationships make all three privacy-first follow states
    // inspectable without putting sample rows or counts in the mobile UI.
    const followSeeds = [
      ["asha@aroha.dev", primaryId, "APPROVED"],
      ["rohan@aroha.dev", primaryId, "APPROVED"],
      ["kabir@aroha.dev", primaryId, "APPROVED"],
      [primaryId, "asha@aroha.dev", "APPROVED"],
      [primaryId, "meera@aroha.dev", "APPROVED"],
      [primaryId, "nandini@aroha.dev", "APPROVED"],
      ["sana@aroha.dev", primaryId, "PENDING"],
      ["nandini@aroha.dev", primaryId, "PENDING"],
    ] as const;
    await prisma.privateFollow.createMany({
      data: followSeeds.map(([requester, owner, status]) => ({
        requesterId: partnerIds.get(requester)?.id ?? requester,
        ownerId: partnerIds.get(owner)?.id ?? owner,
        status,
      })),
      skipDuplicates: true,
    });

    console.log("→ Creating matches and conversations…");
    const matchedSummaries: Array<{
      id: string;
      displayName: string;
      matchId: string;
      conversationId: string | null;
    }> = [];
    const matchByEmail = new Map<string, string>();
    for (const seed of CONVERSATION_SEEDS) {
      const partner = partnerIds.get(seed.partnerEmail);
      if (!partner) continue;
      const matchId = await ensureMatch(prisma, primaryId, partner.id);
      matchByEmail.set(seed.partnerEmail, matchId);
      await ensureConversation(prisma, matchId, primaryId, partner.id, seed);
      const conversation = await prisma.conversation.findUnique({
        where: { matchId },
      });
      matchedSummaries.push({
        id: partner.id,
        displayName: partner.displayName,
        matchId,
        conversationId: conversation?.id ?? null,
      });
    }
    // Add Kabir as a match without a conversation, so the Matches list shows
    // a "Say hi when you're ready" empty-message row.
    const kabir = partnerIds.get("kabir@aroha.dev");
    if (kabir) {
      const matchId = await ensureMatch(prisma, primaryId, kabir.id);
      matchByEmail.set("kabir@aroha.dev", matchId);
      const conversation = await prisma.conversation.findUnique({
        where: { matchId },
      });
      matchedSummaries.push({
        id: kabir.id,
        displayName: kabir.displayName,
        matchId,
        conversationId: conversation?.id ?? null,
      });
    }

    console.log("→ Seeding proposed, accepted, and completed Date Plans…");
    const datePlanIds: string[] = [];
    const datePlanSeeds = [
      {
        email: "asha@aroha.dev",
        key: "demo-date-asha",
        title: "Book browsing and chai",
        locality: "Jubilee Hills",
        status: "PROPOSED" as const,
        startsInHours: 72,
      },
      {
        email: "rohan@aroha.dev",
        key: "demo-date-rohan",
        title: "Public art and coffee",
        locality: "Madhapur",
        status: "ACCEPTED" as const,
        startsInHours: 24,
      },
      {
        email: "meera@aroha.dev",
        key: "demo-date-meera",
        title: "Breakfast conversation",
        locality: "Gachibowli",
        status: "COMPLETED" as const,
        startsInHours: -30,
      },
      {
        email: "kabir@aroha.dev",
        key: "demo-date-kabir",
        title: "Weekend heritage walk",
        locality: "Kondapur",
        status: "COMPLETED" as const,
        startsInHours: -72,
        meetAgainOutcome: "NON_MUTUAL" as const,
      },
    ];
    for (const seed of datePlanSeeds) {
      const partner = partnerIds.get(seed.email);
      const matchId = matchByEmail.get(seed.email);
      if (!partner || !matchId) continue;
      datePlanIds.push(
        await ensureDatePlan({
          prisma,
          matchId,
          primaryId,
          partnerId: partner.id,
          ...seed,
        }),
      );
    }

    console.log("→ Seeding notifications…");
    await seedNotifications(prisma, primaryId, matchedSummaries);
    if (datePlanIds[1]) {
      await prisma.notification.upsert({
        where: { dedupeKey: `demo:date-accepted:${datePlanIds[1]}` },
        create: {
          userId: primaryId,
          type: "DATE_ACCEPTED",
          channel: "IN_APP",
          title: "Your date is confirmed",
          body: "The exact public venue is now visible to both of you.",
          data: { datePlanId: datePlanIds[1] },
          status: "PENDING",
          sentAt: new Date(),
          dedupeKey: `demo:date-accepted:${datePlanIds[1]}`,
        },
        update: {},
      });
    }

    console.log("\n✓ Demo data ready.");
    console.log(`  Sign in:  ${PRIMARY_USER.email}  /  ${DEFAULT_PASSWORD}`);
    console.log("  Other accounts (same password):");
    for (const u of OTHER_USERS) {
      console.log(`    - ${u.email} (${u.displayName})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Importing the shared profile helper must never reset the demo conversations.
if (require.main === module) {
  void main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
