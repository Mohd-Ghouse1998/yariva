import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// ── Reference data ──────────────────────────────────────────────────────────

// Curated interest taxonomy split across THINGS_I_DO and THINGS_I_LOVE
// categories so the InterestsScreen can render the same buckets the Figma
// design shows.
const interestTags = [
  // Things I do (active / lifestyle)
  ["gym", "Gym", "things-i-do"],
  ["running", "Running", "things-i-do"],
  ["yoga", "Yoga", "things-i-do"],
  ["hiking", "Hiking", "things-i-do"],
  ["cycling", "Cycling", "things-i-do"],
  ["dancing", "Dancing", "things-i-do"],
  ["pottery", "Pottery", "things-i-do"],
  ["cooking", "Cooking", "things-i-do"],
  // Things I love (taste / culture)
  ["coffee", "Coffee", "things-i-love"],
  ["books", "Books", "things-i-love"],
  ["music", "Music", "things-i-love"],
  ["movies", "Movies", "things-i-love"],
  ["travel", "Travel", "things-i-love"],
  ["photography", "Photography", "things-i-love"],
  ["art", "Art", "things-i-love"],
  ["foodie", "Foodie", "things-i-love"],
] as const;

const featureFlags = [
  {
    key: "discovery.v1",
    description: "Enable Phase 1 discovery feed",
    enabled: true,
  },
  {
    key: "calls.v1",
    description: "Enable Phase 1 voice and video calls",
    enabled: true,
  },
  {
    key: "scenes.v1",
    description: "Enable Scene publishing and intent-based discovery",
    enabled: true,
  },
  {
    key: "wingman.v1",
    description: "Enable private Wingman parties and invitations",
    enabled: true,
  },
  {
    key: "moderation.auto_photo_approval_stub",
    description: "Use deterministic local photo moderation stub",
    enabled: true,
  },
] as const;

// Demo viewer — sign in with these credentials in the app to see the seeded
// dummy world. Override with SEED_VIEWER_EMAIL env var.
const VIEWER_EMAIL = process.env.SEED_VIEWER_EMAIL ?? "demo@aroha.dev";
const VIEWER_PASSWORD = process.env.SEED_VIEWER_PASSWORD ?? "demo1234";

// ── Dummy users ─────────────────────────────────────────────────────────────
// Each entry is everything we need to create a complete profile. Photos are
// Unsplash URLs served via the "external" sentinel bucket the
// ObjectStorageService recognises in dev seeds. Coordinates anchor around
// Wellington (NZ) to make the distance-from-viewer numbers feel real.

interface DummyUser {
  email: string;
  displayName: string;
  age: number;
  gender: "WOMAN" | "MAN" | "NON_BINARY";
  pronouns: string;
  city: string;
  region: string;
  countryCode: string;
  lat: number;
  lng: number;
  headline: string;
  bio: string;
  intents: Array<
    "FRIENDSHIP" | "COMPANIONSHIP" | "SHARED_INTERESTS" | "RELATIONSHIP"
  >;
  interestSlugs: string[];
  lifestyle: {
    smoking: "NEVER" | "OCCASIONAL" | "REGULAR";
    drinking: "NEVER" | "OCCASIONAL" | "SOCIAL" | "REGULAR";
    exercise: "OCCASIONAL" | "WEEKLY" | "FREQUENT";
    diet: "OMNIVORE" | "VEGETARIAN" | "VEGAN" | "PESCATARIAN";
  };
  photos: string[]; // Unsplash URLs.
}

// Photos are square 800×800 portraits cropped from public Unsplash photos.
// Each user gets 1–3 photos so the photo-dot carousel has something to do.
const dummyUsers: DummyUser[] = [
  {
    email: "asha@aroha.dev",
    displayName: "Asha",
    age: 29,
    gender: "WOMAN",
    pronouns: "she / her",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.2925,
    lng: 174.7762,
    headline: "Watercolours, used bookstores, late-night biryani.",
    bio: "Botanist by day. I keep a sourdough starter named Walter and read three books at once. Looking for someone to wander the weekend market with — bonus points if you know a great coffee spot.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["books", "coffee", "art", "cooking", "hiking"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "WEEKLY",
      diet: "VEGETARIAN",
    },
    photos: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
    ],
  },
  {
    email: "leo@aroha.dev",
    displayName: "Leo",
    age: 31,
    gender: "MAN",
    pronouns: "he / him",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.299,
    lng: 174.78,
    headline: "5km a day, slow coffee, slower books.",
    bio: "Architect, runner, and recovering perfectionist. Looking for a running partner who'll keep me honest at 6am — or honestly, just someone to share a flat white after.",
    intents: ["FRIENDSHIP", "RELATIONSHIP"],
    interestSlugs: ["running", "gym", "coffee", "books", "travel"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "OCCASIONAL",
      exercise: "FREQUENT",
      diet: "OMNIVORE",
    },
    photos: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80",
    ],
  },
  {
    email: "iris@aroha.dev",
    displayName: "Iris",
    age: 27,
    gender: "WOMAN",
    pronouns: "she / her",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.286,
    lng: 174.77,
    headline: "Pottery, peony season, Pixar reruns.",
    bio: "I make ceramics on weekends and pretend to know about wine. New to Wellington and looking for friends who'll explore galleries, hikes, and the occasional terrible karaoke night.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["pottery", "art", "movies", "hiking", "foodie"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "WEEKLY",
      diet: "OMNIVORE",
    },
    photos: [
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80",
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80",
    ],
  },
  {
    email: "rohan@aroha.dev",
    displayName: "Rohan",
    age: 32,
    gender: "MAN",
    pronouns: "he / him",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.305,
    lng: 174.79,
    headline: "Architect, runner, slow-coffee evangelist.",
    bio: "Designing weekend hikes for fun and weekday buildings for work. Big believer that the best conversations happen on a long walk. Looking for hiking buddies and maybe more.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS", "RELATIONSHIP"],
    interestSlugs: ["hiking", "running", "coffee", "photography", "travel"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "FREQUENT",
      diet: "OMNIVORE",
    },
    photos: [
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80",
      "https://images.unsplash.com/photo-1463453091185-61582044d556?w=800&q=80",
    ],
  },
  {
    email: "priya@aroha.dev",
    displayName: "Priya",
    age: 28,
    gender: "WOMAN",
    pronouns: "she / her",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.295,
    lng: 174.775,
    headline: "Yoga, jazz, jhal-muri at midnight.",
    bio: "Yoga teacher who can't sit still. I want to find a yoga partner for the 6am Lambton class and a friend who's down for spontaneous Sunday road trips.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["yoga", "music", "travel", "foodie", "dancing"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "OCCASIONAL",
      exercise: "FREQUENT",
      diet: "VEGAN",
    },
    photos: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80",
    ],
  },
  {
    email: "kabir@aroha.dev",
    displayName: "Kabir",
    age: 30,
    gender: "MAN",
    pronouns: "he / him",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.288,
    lng: 174.768,
    headline: "Gym five days, biryani seven.",
    bio: "Software engineer who lifts. Looking for a gym partner who'll actually show up at 7am — protein shakes are on me. Open to friendship first, more if it clicks.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["gym", "running", "foodie", "movies", "music"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "FREQUENT",
      diet: "OMNIVORE",
    },
    photos: [
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&q=80",
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80",
    ],
  },
  {
    email: "meera@aroha.dev",
    displayName: "Meera",
    age: 26,
    gender: "WOMAN",
    pronouns: "she / her",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.301,
    lng: 174.785,
    headline: "Photographer, dog-mom, occasional poet.",
    bio: "I shoot weddings on weekends and chase golden hour the rest of the time. Looking for a photo-walk partner who doesn't mind detours and dog hair.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS", "RELATIONSHIP"],
    interestSlugs: ["photography", "travel", "art", "coffee", "books"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "WEEKLY",
      diet: "PESCATARIAN",
    },
    photos: [
      "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=800&q=80",
      "https://images.unsplash.com/photo-1463453091185-61582044d556?w=800&q=80",
    ],
  },
  {
    email: "arjun@aroha.dev",
    displayName: "Arjun",
    age: 33,
    gender: "MAN",
    pronouns: "he / him",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.31,
    lng: 174.795,
    headline: "Cyclist, cook, dadbod-in-training.",
    bio: "Recently moved here. Looking for a cycling partner for weekend rides up Mt Vic, and someone to argue about the best ramen joint in town.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["cycling", "cooking", "foodie", "travel", "movies"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "FREQUENT",
      diet: "OMNIVORE",
    },
    photos: [
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80",
      "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=800&q=80",
    ],
  },
  {
    email: "nadia@aroha.dev",
    displayName: "Nadia",
    age: 30,
    gender: "WOMAN",
    pronouns: "she / her",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.293,
    lng: 174.78,
    headline: "Dancer, dessert-first, deeply curious.",
    bio: "Salsa on Tuesdays, bookshops on Saturdays. Open to dating but in no rush — would love to meet someone with their own thing going on.",
    intents: ["RELATIONSHIP", "FRIENDSHIP"],
    interestSlugs: ["dancing", "books", "music", "foodie", "art"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "FREQUENT",
      diet: "VEGETARIAN",
    },
    photos: [
      "https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=800&q=80",
      "https://images.unsplash.com/photo-1521252659862-eec69941b071?w=800&q=80",
    ],
  },
  {
    email: "vikram@aroha.dev",
    displayName: "Vikram",
    age: 35,
    gender: "MAN",
    pronouns: "he / him",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.31,
    lng: 174.77,
    headline: "Slow runner, fast reader, quietly stubborn.",
    bio: "Mostly looking for friends who like long walks, longer dinners, and the occasional weekend trip out of town. Open to a relationship if there's actual connection.",
    intents: ["FRIENDSHIP", "RELATIONSHIP", "COMPANIONSHIP"],
    interestSlugs: ["running", "books", "travel", "foodie", "coffee"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "OCCASIONAL",
      exercise: "FREQUENT",
      diet: "OMNIVORE",
    },
    photos: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80",
    ],
  },
  {
    email: "sara@aroha.dev",
    displayName: "Sara",
    age: 29,
    gender: "WOMAN",
    pronouns: "she / her",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.296,
    lng: 174.776,
    headline: "Coffee snob, Sunday cyclist, terrible singer.",
    bio: "I write code and bake bread. Looking for cycling partners and friends who enjoy long quiet Sunday mornings. Pets are a plus.",
    intents: ["FRIENDSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["cycling", "coffee", "cooking", "books", "music"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "FREQUENT",
      diet: "VEGETARIAN",
    },
    photos: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
    ],
  },
  {
    email: "dev@aroha.dev",
    displayName: "Dev",
    age: 28,
    gender: "MAN",
    pronouns: "he / him",
    city: "Wellington",
    region: "Wellington",
    countryCode: "NZ",
    lat: -41.302,
    lng: 174.79,
    headline: "Hiker, home-cook, quietly funny.",
    bio: "Weekend hiker with strong opinions about trail snacks. Cooking for one is fine but cooking for two is more fun. Up for friends or more — let's see.",
    intents: ["FRIENDSHIP", "RELATIONSHIP", "SHARED_INTERESTS"],
    interestSlugs: ["hiking", "cooking", "music", "movies", "travel"],
    lifestyle: {
      smoking: "NEVER",
      drinking: "SOCIAL",
      exercise: "FREQUENT",
      diet: "PESCATARIAN",
    },
    photos: [
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80",
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=800&q=80",
    ],
  },
];

// ── Seed runner ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // 1. Interest tags + feature flags (idempotent).
    for (const [slug, displayName, category] of interestTags) {
      await prisma.interestTag.upsert({
        where: { slug },
        create: { slug, displayName, category },
        update: { displayName, category, isActive: true },
      });
    }

    for (const flag of featureFlags) {
      await prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: {
          key: flag.key,
          description: flag.description,
          scope: "GLOBAL",
          enabled: flag.enabled,
          rolloutPercentage: null,
          variant: null,
          config: {},
          allowlistUserIds: [],
        },
        update: {
          description: flag.description,
          scope: "GLOBAL",
          enabled: flag.enabled,
          deletedAt: null,
        },
      });
    }

    // 2. Demo viewer + dummy users — full profile for each.
    const allInterestTags = await prisma.interestTag.findMany();
    const interestBySlug = new Map(allInterestTags.map((t) => [t.slug, t]));

    const viewerHash = await hash(VIEWER_PASSWORD, 10);
    const viewer = await ensureUser(
      prisma,
      {
        email: VIEWER_EMAIL,
        passwordHash: viewerHash,
        displayName: "You",
        age: 30,
        gender: "WOMAN",
        pronouns: "she / her",
        city: "Wellington",
        region: "Wellington",
        countryCode: "NZ",
        lat: -41.2925,
        lng: 174.7762,
        headline: "Demo viewer for the seeded world.",
        bio: "This account is created by the seed so you can browse the dummy people.",
        intents: ["FRIENDSHIP", "SHARED_INTERESTS", "RELATIONSHIP"],
        interestSlugs: ["coffee", "books", "running", "travel", "music"],
        lifestyle: {
          smoking: "NEVER",
          drinking: "SOCIAL",
          exercise: "FREQUENT",
          diet: "OMNIVORE",
        },
        photos: [
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80",
        ],
      },
      interestBySlug,
    );

    const dummyHash = await hash("password123", 10);
    const createdDummies: { id: string; email: string }[] = [];
    for (const dummy of dummyUsers) {
      const u = await ensureUser(
        prisma,
        { ...dummy, passwordHash: dummyHash },
        interestBySlug,
      );
      createdDummies.push({ id: u.id, email: dummy.email });
    }

    // 3. A handful of incoming likes for the demo viewer.
    const likers = createdDummies.slice(0, 5);
    for (const liker of likers) {
      await prisma.like.upsert({
        where: { actorId_targetId: { actorId: liker.id, targetId: viewer.id } },
        create: { actorId: liker.id, targetId: viewer.id, status: "ACTIVE" },
        update: { status: "ACTIVE", retractedAt: null },
      });
    }

    // 4. Two pre-made matches with a starter conversation each. We only
    //    create matches for dummies the viewer has *also* liked, so the
    //    canonical-pair invariant holds.
    const matchPartners = createdDummies.slice(5, 7);
    for (const partner of matchPartners) {
      // Viewer likes them (already counts the partner-side like below).
      await prisma.like.upsert({
        where: {
          actorId_targetId: { actorId: viewer.id, targetId: partner.id },
        },
        create: {
          actorId: viewer.id,
          targetId: partner.id,
          status: "MATCHED",
          matchedAt: new Date(),
        },
        update: { status: "MATCHED", matchedAt: new Date(), retractedAt: null },
      });
      await prisma.like.upsert({
        where: {
          actorId_targetId: { actorId: partner.id, targetId: viewer.id },
        },
        create: {
          actorId: partner.id,
          targetId: viewer.id,
          status: "MATCHED",
          matchedAt: new Date(),
        },
        update: { status: "MATCHED", matchedAt: new Date(), retractedAt: null },
      });

      const [low, high] =
        viewer.id < partner.id
          ? [viewer.id, partner.id]
          : [partner.id, viewer.id];
      const match = await prisma.match.upsert({
        where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
        create: {
          userLowId: low,
          userHighId: high,
          status: "ACTIVE",
          matchedAt: new Date(),
        },
        update: { status: "ACTIVE" },
      });

      // Match-side communication settings (both sides allow voice + video).
      for (const uid of [viewer.id, partner.id]) {
        await prisma.matchCommunicationSetting.upsert({
          where: { matchId_userId: { matchId: match.id, userId: uid } },
          create: {
            matchId: match.id,
            userId: uid,
            allowVoiceCalls: true,
            allowVideoCalls: true,
          },
          update: {},
        });
      }

      // One conversation per match, with two starter messages so the chat
      // tab shows real previews.
      const convo = await prisma.conversation.upsert({
        where: { matchId: match.id },
        create: {
          matchId: match.id,
          status: "ACTIVE",
          lastMessageSequence: 2,
          lastMessageType: "TEXT",
          lastMessagePreview: "Yes please. Saturday afternoon?",
          lastMessageSentAt: new Date(),
          lastSenderId: partner.id,
        },
        update: {},
      });

      // Recreate the two messages cleanly (delete & insert keeps seed
      // idempotent).
      await prisma.message.deleteMany({ where: { conversationId: convo.id } });
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: viewer.id,
          sequence: 1,
          type: "TEXT",
          textBody: "Hey! Loved your bio — what are you reading right now?",
        },
      });
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: partner.id,
          sequence: 2,
          type: "TEXT",
          textBody: "Yes please. Saturday afternoon?",
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `\nSeed complete.\n  Viewer login: ${VIEWER_EMAIL} / ${VIEWER_PASSWORD}\n  ${createdDummies.length} dummy users · ${likers.length} incoming likes · ${matchPartners.length} pre-made matches.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface UserSeedInput {
  email: string;
  passwordHash: string;
  displayName: string;
  age: number;
  gender: "WOMAN" | "MAN" | "NON_BINARY";
  pronouns: string;
  city: string;
  region: string;
  countryCode: string;
  lat: number;
  lng: number;
  headline: string;
  bio: string;
  intents: Array<
    "FRIENDSHIP" | "COMPANIONSHIP" | "SHARED_INTERESTS" | "RELATIONSHIP"
  >;
  interestSlugs: string[];
  lifestyle: {
    smoking: "NEVER" | "OCCASIONAL" | "REGULAR";
    drinking: "NEVER" | "OCCASIONAL" | "SOCIAL" | "REGULAR";
    exercise: "OCCASIONAL" | "WEEKLY" | "FREQUENT";
    diet: "OMNIVORE" | "VEGETARIAN" | "VEGAN" | "PESCATARIAN";
  };
  photos: string[];
}

// Creates / updates a user with a complete profile (UserProfile + intents +
// interests + lifestyle + schedule + discovery + communication + photos).
// Safe to re-run.
async function ensureUser(
  prisma: PrismaClient,
  input: UserSeedInput,
  interestBySlug: Map<string, { id: string }>,
) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  const dob = new Date();
  dob.setUTCFullYear(dob.getUTCFullYear() - input.age);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          isShadowBanned: false,
          isDiscoveryFrozen: false,
          isChatFrozen: false,
          isCallFrozen: false,
          lastActiveAt: new Date(),
          deletedAt: null,
        },
      })
    : await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          status: "ACTIVE",
          lastActiveAt: new Date(),
        },
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
      isHidden: false,
      isComplete: true,
      completedAt: new Date(),
      deletedAt: null,
    },
  });

  // Intents — replace fully so removing a slug from the seed actually drops
  // the row.
  await prisma.userIntent.deleteMany({ where: { userId: user.id } });
  for (const intent of input.intents) {
    await prisma.userIntent.create({ data: { userId: user.id, intent } });
  }

  // Interests — same delete-and-replace strategy.
  await prisma.userInterest.deleteMany({ where: { userId: user.id } });
  for (const slug of input.interestSlugs) {
    const tag = interestBySlug.get(slug);
    if (!tag) continue;
    await prisma.userInterest.create({
      data: { userId: user.id, interestTagId: tag.id },
    });
  }

  await prisma.userLifestyle.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      smoking: input.lifestyle.smoking,
      drinking: input.lifestyle.drinking,
      exercise: input.lifestyle.exercise,
      diet: input.lifestyle.diet,
    },
    update: {
      smoking: input.lifestyle.smoking,
      drinking: input.lifestyle.drinking,
      exercise: input.lifestyle.exercise,
      diet: input.lifestyle.diet,
    },
  });

  // Reasonable schedule defaults — Mon–Fri evenings + weekends.
  await prisma.userSchedulePreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      // weekdayMask: bits 0..6 = Mon..Sun. Tue/Wed/Thu/Sat/Sun = 0b1110110 = 118
      weekdayMask: 118,
      // timeBlockMask: 4 blocks (morning/lunch/afternoon/evening) = 0b1101 = 13
      timeBlockMask: 13,
      prefersWeekends: true,
      remoteFriendly: true,
      maxMeetupsPerWeek: 3,
      preferredLeadTimeDays: 2,
      timezone: "Pacific/Auckland",
    },
    update: {},
  });

  await prisma.userDiscoveryPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      minAge: 22,
      maxAge: 40,
      maxDistanceKm: 50,
      intentFilter: input.intents,
      preferredGenders: [],
      preferSameCity: false,
      includeRecentlyActiveOnly: false,
    },
    update: {
      intentFilter: input.intents,
    },
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

  // Photos — wipe and re-create so the order in the seed file is the order
  // the user sees them. Bucket "external" tells ObjectStorageService to
  // return the objectKey URL as-is.
  await prisma.profilePhoto.deleteMany({ where: { userId: user.id } });
  for (let i = 0; i < input.photos.length; i++) {
    const url = input.photos[i]!;
    await prisma.profilePhoto.create({
      data: {
        userId: user.id,
        bucket: "external",
        objectKey: url,
        mimeType: "image/jpeg",
        sizeBytes: 200_000,
        width: 800,
        height: 800,
        position: i,
        isPrimary: i === 0,
        moderationStatus: "APPROVED",
        approvedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
  }

  return user;
}

void main();
