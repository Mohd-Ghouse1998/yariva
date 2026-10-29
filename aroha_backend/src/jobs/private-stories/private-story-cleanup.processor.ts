import { AppLogger } from "../../common/logger/app-logger.service";
import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import objectStorageConfig from "../../config/object-storage.config";
import { PrismaService } from "../../database/prisma/prisma.service";
import { BullmqProducer } from "../../integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../integrations/object-storage/object-storage.service";
import { PRIVATE_STORY_POLICY } from "../../modules/private-stories/domain/private-story.policy";

@Injectable()
export class PrivateStoryCleanupProcessor implements OnApplicationBootstrap {
  constructor(private readonly queue: BullmqProducer, private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    @Inject(objectStorageConfig.KEY) private readonly config: ConfigType<typeof objectStorageConfig>,
    private readonly logger: AppLogger) {}

  async onApplicationBootstrap() {
    await this.queue.scheduleRecurring("private-story.cleanup", 86_400_000);
  }

  async process(now = new Date()) {
    const started = Date.now();
    let removedStories = 0, removedOrphans = 0, scannedObjects = 0;
    const retentionCutoff = new Date(now.getTime() - PRIVATE_STORY_POLICY.retentionDays * 86_400_000);
    // New saves require an active Story. Recheck under the same row lock used
    // by save/delete so a new deletion cannot lose its retention window.
    const where = { OR: [{ savedAt: null, deletedAt: null, expiresAt: { lt: retentionCutoff } }, { deletedAt: { lt: retentionCutoff } }] };
    let pendingStories: number | null = null;
    let stage = "backlog";
    try {
      pendingStories = await this.prisma.privateStory.count({ where });
      this.logger.log(JSON.stringify({ event: "private-story.cleanup.started", pendingStories }));
      stage = "retention";
      // Media remains private during the retention window for reported content.
      // Delete the object first; a failed delete must never orphan a DB record.
      while (true) {
        const stories = await this.prisma.privateStory.findMany({
          where,
          select: { id: true, mediaBucket: true, mediaObjectKey: true }, take: 100,
        });
        if (!stories.length) break;
        for (const story of stories) {
          const removed = await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT "id" FROM "PrivateStory" WHERE "id" = ${story.id}::uuid FOR UPDATE`;
            const current = await tx.privateStory.findFirst({ where: { id: story.id, ...where },
              select: { id: true, mediaBucket: true, mediaObjectKey: true } });
            if (!current) return false;
            if (current.mediaBucket && current.mediaObjectKey)
              await this.storage.deleteObject({ bucket: current.mediaBucket, objectKey: current.mediaObjectKey });
            await tx.privateStory.delete({ where: { id: current.id } });
            return true;
          });
          if (removed) removedStories++;
        }
      }

      // Signed upload links last ten minutes. One day later, any object under
      // this namespace without a Story reference is abandoned and may be purged.
      stage = "orphans";
      const orphanCutoff = new Date(now.getTime() - 86_400_000);
      let continuationToken: string | undefined;
      do {
        const page = await this.storage.listObjects({ bucket: this.config.bucketMessageAttachments,
          prefix: "private-stories/", continuationToken });
        scannedObjects += page.objects.length;
        const candidates = page.objects.filter(item => item.lastModified < orphanCutoff);
        const referenced = await this.prisma.privateStory.findMany({
          where: { mediaObjectKey: { in: candidates.map(item => item.objectKey) } }, select: { mediaObjectKey: true },
        });
        const used = new Set(referenced.map(item => item.mediaObjectKey));
        for (const item of candidates) if (!used.has(item.objectKey)) {
          await this.storage.deleteObject({ bucket: this.config.bucketMessageAttachments, objectKey: item.objectKey });
          removedOrphans++;
        }
        continuationToken = page.nextToken;
      } while (continuationToken);
      stage = "verification";
      const remainingStories = await this.prisma.privateStory.count({ where });
      this.logger.log(JSON.stringify({ event: "private-story.cleanup.completed", removedStories,
        removedOrphans, scannedObjects, remainingStories, durationMs: Date.now() - started }));
    } catch (error) {
      // Keep diagnostics content-free; let the queue retain the original failure and retry.
      this.logger.error(JSON.stringify({ event: "private-story.cleanup.failed", stage, pendingStories,
        removedStories, removedOrphans, scannedObjects, durationMs: Date.now() - started }));
      throw error;
    }
  }
}
