/** Add four fictional Hyderabad profiles without resetting existing chats/data. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { RedisService } from "../src/integrations/redis/redis.service";
import { DiscoverySnapshotRepository } from "../src/modules/discovery/infrastructure/discovery.infrastructure";
import { ensureUser, type DemoUserInput } from "./demo-seed";

const DEMO_MARKER = "Demo profile — fictional person with an AI-generated portrait.";
const ASSETS = join(__dirname, "demo-assets", "indian-profiles");
const VIEWER_EMAIL = process.env.SEED_VIEWER_EMAIL ?? "chinmoy@aroha.dev";

const common = {
  city: "Hyderabad", region: "Telangana", countryCode: "IN",
  intents: ["DATING", "COMMITTED_RELATIONSHIP"] as DemoUserInput["intents"],
  verificationStatus: "UNVERIFIED" as const,
};

export const INDIAN_DEMO_PROFILES: ReadonlyArray<DemoUserInput & { assetName: string }> = [
  {
    ...common, assetName: "aarav", email: "demo-india-aarav@yariva.test",
    displayName: "Aarav · Demo", age: 28, gender: "MAN", pronouns: "he/him",
    lat: 17.4307, lng: 78.4104,
    headline: "Filter coffee, weekend hikes, slow conversations",
    bio: `${DEMO_MARKER} Architect who enjoys sketching old buildings, cooking for friends and early walks at KBR Park. Looking for a kind connection and a coffee plan we both want to keep.`,
    interestSlugs: ["coffee", "hiking", "books", "cooking"],
  },
  {
    ...common, assetName: "vihaan", email: "demo-india-vihaan@yariva.test",
    displayName: "Vihaan · Demo", age: 26, gender: "MAN", pronouns: "he/him",
    lat: 17.4412, lng: 78.3862,
    headline: "Indie music, board games, Sunday biryani",
    bio: `${DEMO_MARKER} Product engineer and amateur photographer. I like bookshop detours, low-key gigs and learning a new recipe together. Happy to start with a public cafe and an honest conversation.`,
    interestSlugs: ["music", "movies", "coffee", "travel"],
  },
  {
    ...common, assetName: "ishita", email: "demo-india-ishita@yariva.test",
    displayName: "Ishita · Demo", age: 27, gender: "WOMAN", pronouns: "she/her",
    lat: 17.4246, lng: 78.4558,
    headline: "Bookstores, pottery, one more chai",
    bio: `${DEMO_MARKER} UX researcher who collects cafe recommendations and learns pottery on weekends. Looking for someone curious, considerate and comfortable making a simple plan rather than chatting forever.`,
    interestSlugs: ["books", "coffee", "movies", "travel"],
  },
  {
    ...common, assetName: "kavya", email: "demo-india-kavya@yariva.test",
    displayName: "Kavya · Demo", age: 29, gender: "WOMAN", pronouns: "she/her",
    lat: 17.4144, lng: 78.4435,
    headline: "Classical dance, park walks, home-cooked food",
    bio: `${DEMO_MARKER} Teacher and dance learner who enjoys quiet mornings and small adventures around Hyderabad. I appreciate direct communication, kindness and an unhurried coffee after a public park walk.`,
    interestSlugs: ["music", "coffee", "cooking", "books"],
  },
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireLocalUrl(value: string, name: string): URL {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(`${name} must point to the local development services`);
  }
  return url;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Demo seeding is disabled in production");
  const connectionString = required("DATABASE_URL");
  const database = requireLocalUrl(connectionString, "DATABASE_URL");
  if (database.pathname !== "/aroha_live") throw new Error("Expected the local aroha_live development database");
  const endpoint = requireLocalUrl(required("OBJECT_STORAGE_ENDPOINT"), "OBJECT_STORAGE_ENDPOINT");
  const redisUrl = required("REDIS_URL"); requireLocalUrl(redisUrl, "REDIS_URL");
  const bucket = required("OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS");

  // Preflight every asset before opening a transaction or uploading anything.
  const assets = await Promise.all(INDIAN_DEMO_PROFILES.map(async (profile) => {
    const bytes = await readFile(join(ASSETS, `${profile.assetName}.png`));
    if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error(`Invalid portrait asset: ${profile.assetName}`);
    }
    return { profile, bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
      key: `local-demo/indian-profiles/${profile.assetName}.png` };
  }));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const storage = new S3Client({
    endpoint: endpoint.toString(), region: process.env.OBJECT_STORAGE_REGION ?? "auto",
    forcePathStyle: (process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: required("OBJECT_STORAGE_ACCESS_KEY"), secretAccessKey: required("OBJECT_STORAGE_SECRET_KEY") },
  });
  const redis = new RedisService(new ConfigService({ redis: { url: redisUrl } }));
  redis.options.maxRetriesPerRequest = 1;
  redis.options.retryStrategy = () => null;
  redis.on("error", () => undefined);
  try {
    await redis.connect();
    // Never commandeer an existing non-demo account that happens to use this email.
    for (const { profile } of assets) {
      const existing = await prisma.user.findUnique({ where: { email: profile.email }, include: { profile: true } });
      if (existing && !existing.profile?.bio?.startsWith(DEMO_MARKER)) throw new Error(`Reserved demo email is already in use: ${profile.assetName}`);
    }
    for (const { bytes, key } of assets) {
      await storage.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes,
        ContentType: "image/png", Metadata: { "yariva-demo": "synthetic-portrait" } }));
    }
    const ids = await prisma.$transaction(async (tx) => {
      const created: string[] = [];
      for (const { profile, bytes, key, width, height } of assets) {
        // Reuse the existing complete-profile builder, then attach a private object.
        // All intermediate photo state is inside this transaction, never exposed.
        const id = await ensureUser(tx, { ...profile, photoUrls: [`${endpoint.origin}/${bucket}/${key}`] });
        await tx.profilePhoto.updateMany({ where: { userId: id, deletedAt: null, purpose: "PROFILE" },
          data: { bucket, objectKey: key, mimeType: "image/png", sizeBytes: bytes.length, width, height } });
        await tx.userProfile.update({ where: { userId: id }, data: { shareSensitiveCompatibility: false } });
        created.push(id);
      }
      return created;
    }, { timeout: 60_000 });
    const viewer = await prisma.user.findUnique({ where: { email: VIEWER_EMAIL }, select: { id: true } });
    if (viewer) await new DiscoverySnapshotRepository(redis).invalidateViewer(viewer.id);
    console.log(`Ready: ${ids.length} fictional Indian demo profiles (2 men, 2 women).`);
    console.log("Existing chats, matches, viewer preferences and daily discovery limit were preserved.");
  } finally {
    await prisma.$disconnect(); storage.destroy();
    if (redis.status === "ready") await redis.quit(); else redis.disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Demo seeding failed");
    process.exitCode = 1;
  });
}
