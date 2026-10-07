import { VibesService } from "./vibes.service";

const readyVibe = {
  id: "10000000-0000-4000-8000-000000000001",
  userId: "10000000-0000-4000-8000-000000000002",
  status: "READY",
  filter: "ORIGINAL",
  audioMode: "ORIGINAL",
  sourceBucket: "vibe-media",
  sourceObjectKey: "source.mp4",
  sourceMimeType: "video/mp4",
  sourceSizeBytes: 100,
  sourceUploadTokenHash: "0".repeat(64),
  musicBucket: null,
  musicObjectKey: null,
  musicMimeType: null,
  musicSizeBytes: null,
  musicName: null,
  musicUploadTokenHash: null,
  processedBucket: "vibe-media",
  processedObjectKey: "ready.mp4",
  processedMimeType: "video/mp4",
  processedSizeBytes: 90,
  thumbnailBucket: "vibe-media",
  thumbnailObjectKey: "thumb.jpg",
  durationMs: 5000,
  width: 720,
  height: 1280,
  videoCodec: "h264",
  audioCodec: "aac",
  moderationStatus: "APPROVED",
  failureReason: null,
  uploadExpiresAt: new Date(Date.now() + 60_000),
  readyAt: new Date(),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  moderationProvider: "test-provider",
  moderationReason: null,
  moderatedAt: new Date(),
  processingCompletedAt: new Date(),
} as const;

describe("VibesService", () => {
  const prisma = {
    vibeMedia: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    block: { findFirst: jest.fn() },
  };
  const storage = {
    canDiscloseMedia: jest.fn().mockResolvedValue(true),
    createPresignedGetObject: jest.fn().mockResolvedValue("https://signed.example/media"),
    headObject: jest.fn(),
    createPresignedPutObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const queue = { enqueue: jest.fn() };
  const service = new VibesService(
    prisma as any,
    storage as any,
    queue as any,
    { error: jest.fn() } as any,
    { bucketVibeMedia: "vibe-media" } as any,
    {
      enabled: true,
      maxDurationSeconds: 5,
      maxVideoSizeBytes: 40 * 1024 * 1024,
      maxMusicSizeBytes: 12 * 1024 * 1024,
      uploadTtlSeconds: 900,
      playbackUrlTtlSeconds: 900,
    } as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it("makes finalize idempotent after a Vibe is ready", async () => {
    prisma.vibeMedia.findUnique.mockResolvedValue(readyVibe);

    const result = await service.finalize(readyVibe.userId, readyVibe.id, {
      video: {
        uploadToken: "unused",
        objectKey: "source.mp4",
        bucket: "vibe-media",
        mimeType: "video/mp4",
        sizeBytes: 100,
      },
      music: null,
    });

    expect(result.vibe.status).toBe("READY");
    expect(result.vibe.playbackUrl).toBe("https://signed.example/media");
    expect(storage.headObject).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("does not reveal or mutate another user's Vibe", async () => {
    prisma.vibeMedia.findUnique.mockResolvedValue(readyVibe);

    await expect(
      service.finalize("10000000-0000-4000-8000-000000000099", readyVibe.id, {
        video: {
          uploadToken: "unused",
          objectKey: "source.mp4",
          bucket: "vibe-media",
          mimeType: "video/mp4",
          sizeBytes: 100,
        },
        music: null,
      }),
    ).rejects.toMatchObject({ code: "VIBE_NOT_OWNED" });
    expect(storage.headObject).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("publishes only a ready, approved Vibe from an eligible active profile", async () => {
    prisma.block.findFirst.mockResolvedValue(null);
    prisma.vibeMedia.findFirst.mockResolvedValue(null);

    await expect(
      service.getForUser(
        "10000000-0000-4000-8000-000000000010",
        readyVibe.userId,
      ),
    ).resolves.toEqual({ vibe: null });

    expect(prisma.vibeMedia.findFirst).toHaveBeenCalledWith({
      where: {
        userId: readyVibe.userId,
        status: "READY",
        moderationStatus: "APPROVED",
        deletedAt: null,
        user: { status: "ACTIVE", deletedAt: null, isShadowBanned: false },
      },
      orderBy: { readyAt: "desc" },
    });
  });
});
