/** Add local-only, consented demo follows and private text Stories for the demo account. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrivateStoriesService } from "../src/modules/private-stories/application/private-stories.service";
import type { PrismaService } from "../src/database/prisma/prisma.service";
import type { ObjectStorageService } from "../src/integrations/object-storage/object-storage.service";

const VIEWER_EMAIL = process.env.SEED_VIEWER_EMAIL ?? "chinmoy@aroha.dev";
const DEMO_MARKER = "Demo profile — fictional person with an AI-generated portrait.";
const demoStories = [
  { email: "demo-india-ishita@yariva.test", text: "Demo · A quiet bookstore and chai sound like a good Sunday plan. What are you reading?" },
  { email: "demo-india-kavya@yariva.test", text: "Demo · Taking a short park walk this evening. Small plans and good conversations are welcome." },
  { email: "demo-india-aarav@yariva.test", text: "Demo · Sketching over filter coffee today. Tell me about a Hyderabad place you love." },
] as const;
const fourthEmail = "demo-india-vihaan@yariva.test";

function assertLocalDatabase(): string {
  const value = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production" || !value) throw new Error("This seed requires a local development database");
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/aroha_live") {
    throw new Error("This seed is restricted to the local aroha_live database");
  }
  return value;
}

/** Explicit opt-in fixtures for the synthetic device account's owner gallery. */
async function seedOwnerGallery(prisma: PrismaClient, social: PrivateStoriesService) {
  const viewer = await prisma.user.findUnique({ where: { email: VIEWER_EMAIL }, include: { profile: true } });
  const recipient = await prisma.user.findUnique({ where: { email: demoStories[0].email }, include: { profile: true } });
  if (!viewer?.email?.startsWith("yariva-device-") || !viewer.email.endsWith("@example.com")
    || viewer.profile?.bio !== "Synthetic test profile for device acceptance."
    || !recipient?.profile?.bio?.startsWith(DEMO_MARKER)) {
    throw new Error("Owner gallery fixtures require a marked synthetic device account and fictional recipient");
  }
  for (const user of [viewer, recipient]) {
    if (user.status !== "ACTIVE" || user.deletedAt || user.isShadowBanned) throw new Error("Fixture account is not active");
  }
  const relationship = await prisma.privateFollow.findUnique({
    where: { requesterId_ownerId: { requesterId: recipient.id, ownerId: viewer.id } },
  });
  if (!relationship) {
    await social.requestFollow(recipient.id, viewer.id);
    await social.approveFollow(viewer.id, recipient.id);
  } else if (relationship.status !== "APPROVED") {
    throw new Error("Existing follow state was preserved; choose an approved fictional recipient");
  }
  const fixtures = [
    { hours: 0.25, text: "Demo · A quiet coffee break ☕" },
    { hours: 2, text: "Demo · Small wins today: finished a book and called an old friend." },
    { hours: 5, text: "Demo · Hyderabad evenings\nGood chai. Better conversations." },
    { hours: 12, text: "Demo · A longer Story to check readability: sometimes the best part of the day is a simple walk, a familiar song, and someone who really listens." },
    { hours: 20, text: "Demo · Yesterday's little moment: watched the sunset after work." },
    { hours: 23, text: "Demo · Almost 24 hours old — this Story will expire soon." },
    { hours: 48, text: "Demo · Expired Story control — retained in the database, absent from active Stories." },
  ];
  let storiesAdded = 0;
  const fixtureIds: string[] = [];
  for (const item of fixtures) {
    const existing = await prisma.privateStory.findFirst({ where: { ownerId: viewer.id, text: item.text, deletedAt: null } });
    if (existing) { fixtureIds.push(existing.id); continue; }
    const result = await social.create(viewer.id, { text: item.text, audienceRule: "SELECTED", recipientIds: [recipient.id] });
    if (result.eligibleCount !== 1) throw new Error("Fixture audience must contain exactly one fictional recipient");
    // Only fixture timestamps are backdated; production creation still owns expiry.
    const createdAt = new Date(Date.now() - item.hours * 3_600_000);
    await prisma.privateStory.update({ where: { id: result.story.id }, data: {
      createdAt, expiresAt: new Date(createdAt.getTime() + 24 * 3_600_000),
    } });
    fixtureIds.push(result.story.id);
    storiesAdded++;
  }
  const gallery = await social.mine(viewer.id);
  const expiredId = fixtureIds[fixtures.length - 1];
  if (!expiredId) throw new Error("Expired fixture was not created");
  if (gallery.items.some(story => story.id === expiredId)) throw new Error("Expired fixture leaked into owner gallery");
  let expiredDetailDenied = false;
  try { await social.detail(viewer.id, expiredId); }
  catch (error) {
    if ((error as { getStatus?: () => number }).getStatus?.() !== 404) throw error;
    expiredDetailDenied = true;
  }
  if (!expiredDetailDenied) throw new Error("Expired fixture remained viewable");
  const grants = await prisma.privateStoryGrant.findMany({ where: { storyId: { in: fixtureIds } } });
  if (grants.length !== fixtures.length || grants.some(grant => grant.recipientId !== recipient.id)) {
    throw new Error("Unexpected fixture recipients");
  }
  console.log(JSON.stringify({ mode: "owner-gallery", storiesAdded,
    activeExamples: gallery.items.filter(story => fixtureIds.includes(story.id)).length,
    expiredExamples: 1, expiredDetailDenied, fictionalRecipientsPerStory: 1 }));
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertLocalDatabase() }) });
  try {
    // No object-storage or notification calls are needed for these text fixtures.
    const social = new PrivateStoriesService(prisma as unknown as PrismaService,
      {} as ObjectStorageService, { bucketMessageAttachments: "local-demo-only" } as never,
      {} as never, {} as never, { execute: async () => ({ enabled: false }) } as never, {} as never);
    if (process.argv.includes("--owner-gallery")) {
      await seedOwnerGallery(prisma, social);
      return;
    }
    const emails = [VIEWER_EMAIL, ...demoStories.map(item => item.email), fourthEmail];
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, status: true, deletedAt: true, isShadowBanned: true, profile: { select: { bio: true } } },
    });
    const byEmail = new Map(users.map(user => [user.email, user]));
    if (users.length !== emails.length) throw new Error("Required demo accounts are missing; seed the fictional Indian profiles first");
    for (const email of emails) {
      const user = byEmail.get(email)!;
      if (user.status !== "ACTIVE" || user.deletedAt || user.isShadowBanned) throw new Error(`Demo account is not active: ${email}`);
      if (email !== VIEWER_EMAIL && !user.profile?.bio?.startsWith(DEMO_MARKER)) throw new Error(`Account is not a marked fictional profile: ${email}`);
    }

    // Text-only Stories do not touch object storage. The service still enforces
    // active accounts, blocks, approved follows, audience grants and 24h expiry.
    // The explicit demo seed never queues recipient notifications.
    const viewerId = byEmail.get(VIEWER_EMAIL)!.id;
    let followsAdded = 0;
    let storiesAdded = 0;

    async function ensureApprovedFollow(requesterId: string, ownerId: string) {
      const key = { requesterId, ownerId };
      const existing = await prisma.privateFollow.findUnique({ where: { requesterId_ownerId: key } });
      if (existing?.status === "APPROVED") return;
      if (existing) throw new Error("A demo follow already exists in a different state; no existing relationship was changed");
      await social.requestFollow(requesterId, ownerId);
      await social.approveFollow(ownerId, requesterId);
      followsAdded++;
    }

    // These follows are deliberately approved for fictional profiles only.
    for (const email of [...demoStories.map(item => item.email), fourthEmail]) {
      await ensureApprovedFollow(viewerId, byEmail.get(email)!.id);
    }
    for (const email of [demoStories[0].email, demoStories[1].email]) {
      await ensureApprovedFollow(byEmail.get(email)!.id, viewerId);
    }

    for (const item of demoStories) {
      const ownerId = byEmail.get(item.email)!.id;
      const existing = await prisma.privateStory.findFirst({
        where: { ownerId, text: item.text, deletedAt: null, expiresAt: { gt: new Date() }, grants: { some: { recipientId: viewerId } } },
      });
      if (existing) continue;
      const result = await social.create(ownerId, { text: item.text, audienceRule: "SELECTED", recipientIds: [viewerId] });
      if (result.eligibleCount !== 1) throw new Error("Demo Story audience was not restricted to the viewer");
      storiesAdded++;
    }

    const summary = await social.followSummary(viewerId);
    const eligibleDemoStories = await prisma.privateStory.count({
      where: { ownerId: { in: demoStories.map(item => byEmail.get(item.email)!.id) }, deletedAt: null,
        expiresAt: { gt: new Date() }, grants: { some: { recipientId: viewerId } } },
    });
    console.log(JSON.stringify({ followsAdded, storiesAdded, summary, eligibleDemoStories }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
