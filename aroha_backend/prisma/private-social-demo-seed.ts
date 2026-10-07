/** Add local-only, consented demo follows and private text Stories for the demo account. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrivateStoriesService } from "../src/modules/private-stories/application/private-stories.service";
import type { PrismaService } from "../src/database/prisma/prisma.service";
import type { ObjectStorageService } from "../src/integrations/object-storage/object-storage.service";

const VIEWER_EMAIL = "chinmoy@aroha.dev";
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
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || url.pathname !== "/aroha_live") {
    throw new Error("This seed is restricted to the local aroha_live database");
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: assertLocalDatabase() }) });
  try {
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
    const social = new PrivateStoriesService(prisma as unknown as PrismaService,
      {} as ObjectStorageService, { bucketMessageAttachments: "local-demo-only" } as never);
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
