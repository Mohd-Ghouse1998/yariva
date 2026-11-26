import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import objectStorageConfig from "../../../config/object-storage.config";
import vibesConfig from "../../../config/vibes.config";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { NotificationIntentService } from "../../notifications/application/notification-intent.service";
import { EvaluateFeatureFlagService } from "../../feature-flags/application/feature-flags.services";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService, type AuditLogInput } from "../../../common/services/audit-log.service";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import { Prisma, type Notification, type PrivateStory } from "../../../generated/prisma/client";
import { findActiveMatchPartnerIds } from "../../matches/infrastructure/matches.infrastructure";
import { canViewProfileField } from "../../profiles/domain/profile-field-audience";
import { activeStory, PRIVATE_STORY_POLICY } from "../domain/private-story.policy";
import { probeMedia, runMediaTool } from "../../../jobs/vibes/vibe-media.processor";
import type { AudienceDto, CreatePrivateStoryDto, InitiatePrivateStoryMediaDto, PrivateCommunityDto, PrivateStoryMediaDto, UpdatePrivateStoryDto } from "../dto/private-stories.dto";

type Db = PrismaService | PrismaTransactionalClient;
type ReviewActor = Pick<AuditLogInput, "actorUserId" | "actorSessionId" | "ipAddress" | "userAgent">;
const missing = () => new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Private Story not found");
const invalid = (message: string) => new AppException(400, ERROR_CODES.VALIDATION_FAILED, message);
const followProfileFields = { displayName: true, city: true, fieldAudiences: true } satisfies Prisma.UserProfileSelect;

@Injectable()
export class PrivateStoriesService {
  private readonly logger = new Logger(PrivateStoriesService.name);
  constructor(private readonly prisma: PrismaService, private readonly storage: ObjectStorageService,
    @Inject(objectStorageConfig.KEY) private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    @Inject(vibesConfig.KEY) private readonly mediaTools: ConfigType<typeof vibesConfig>,
    private readonly notificationIntents: NotificationIntentService,
    private readonly flags: EvaluateFeatureFlagService,
    private readonly audit: AuditLogService) {}

  async initiateMedia(ownerId: string, input: InitiatePrivateStoryMediaDto) {
    if (!await this.activeUser(this.prisma, ownerId)) throw invalid("Account is not active");
    this.assertMediaSize(input.mimeType, input.sizeBytes);
    const uploadToken = randomBytes(32).toString("base64url");
    const suffix = input.mimeType.startsWith("image/") ? input.mimeType.split("/")[1] : input.mimeType === "video/quicktime" ? "mov" : "mp4";
    const objectKey = `private-stories/${ownerId}/${randomUUID()}.${suffix}`;
    const instruction = await this.storage.createPresignedPutObject({
      bucket: this.storageConfig.bucketMessageAttachments, objectKey, mimeType: input.mimeType,
      uploadToken, userId: ownerId, sha256: null, expiresInSeconds: 600,
    });
    return { objectKey, uploadToken, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
      uploadUrl: instruction.uploadUrl, uploadHeaders: instruction.headers, expiresAt: instruction.expiresAt.toISOString() };
  }

  private assertMediaSize(mimeType: string, sizeBytes: number) {
    const max = mimeType.startsWith("image/") ? 10 * 1024 * 1024 : 40 * 1024 * 1024;
    if (sizeBytes < 1 || sizeBytes > max) throw invalid("Story media is too large");
  }

  private async validateMedia(ownerId: string, media: PrivateStoryMediaDto) {
    this.assertMediaSize(media.mimeType, media.sizeBytes);
    if (!/^private-stories\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpeg|png|webp|mp4|mov)$/.test(media.objectKey)
      || !media.objectKey.startsWith(`private-stories/${ownerId}/`)) throw invalid("Invalid Story media");
    try {
      const head = await this.storage.headObject({ bucket: this.storageConfig.bucketMessageAttachments, objectKey: media.objectKey });
      if (head.sizeBytes !== media.sizeBytes || head.mimeType !== media.mimeType
        || head.metadata["aroha-user-id"] !== ownerId || head.metadata["aroha-upload-token"] !== media.uploadToken)
        throw invalid("Story media upload did not match");
      const object = await this.storage.readObjectStream({ bucket: this.storageConfig.bucketMessageAttachments,
        objectKey: media.objectKey, range: "bytes=0-31" });
      const signature = object.Body ? Buffer.from(await object.Body.transformToByteArray()) : Buffer.alloc(0);
      const isImage = media.mimeType === "image/png" ? signature.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
        : media.mimeType === "image/jpeg" ? signature.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
          : media.mimeType === "image/webp" ? signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP" : false;
      const isVideo = (media.mimeType === "video/mp4" || media.mimeType === "video/quicktime")
        && signature.toString("ascii", 4, 8) === "ftyp";
      if (!isImage && !isVideo) throw invalid("Story media format did not match");
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw invalid("Story media upload is unavailable");
    }
  }

  private async sanitizeMedia(ownerId: string, media: PrivateStoryMediaDto) {
    const bucket = this.storageConfig.bucketMessageAttachments;
    const workspace = await mkdtemp(join(tmpdir(), "yariva-story-"));
    const source = join(workspace, "source");
    const isVideo = media.mimeType.startsWith("video/");
    const mimeType = media.mimeType === "video/quicktime" ? "video/mp4" : media.mimeType;
    const extension = mimeType.split("/")[1];
    const output = join(workspace, `clean.${extension}`);
    const objectKey = `private-stories/${ownerId}/${randomUUID()}.clean.${extension}`;
    try {
      await this.storage.downloadObjectToFile({ bucket, objectKey: media.objectKey, destinationPath: source, maxBytes: media.sizeBytes });
      const probe = await probeMedia(this.mediaTools.ffprobePath, source);
      const image = probe.streams?.find(stream => stream.codec_type === "video");
      if (!image?.width || !image.height || image.width > 4096 || image.height > 4096) throw invalid("Story media dimensions are invalid");
      if (isVideo) {
        const duration = Number(probe.format?.duration);
        if (!Number.isFinite(duration) || duration <= 0 || duration > 30) throw invalid("Story video must be 30 seconds or less");
      }
      const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", source,
        "-map_metadata", "-1", "-map_chapters", "-1", "-map", "0:v:0"];
      if (isVideo) args.push("-map", "0:a:0?", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart");
      else args.push("-frames:v", "1", "-update", "1");
      await runMediaTool(this.mediaTools.ffmpegPath, [...args, output], isVideo ? 90_000 : 30_000);
      const sizeBytes = await this.storage.putFile({ bucket, objectKey, sourcePath: output, mimeType });
      if (sizeBytes < 1 || sizeBytes > (isVideo ? 40 : 10) * 1024 * 1024) {
        await this.storage.deleteObject({ bucket, objectKey });
        throw invalid("Processed Story media is too large");
      }
      return { bucket, objectKey, mimeType, sizeBytes };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw invalid("Story media could not be processed");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  private async activeUser(db: Db, userId: string): Promise<boolean> {
    return !!await db.user.findFirst({ where: { id: userId, status: "ACTIVE", deletedAt: null, isShadowBanned: false }, select: { id: true } });
  }

  private async blocked(db: Db, a: string, b: string): Promise<boolean> {
    return !!await db.block.findFirst({ where: { deletedAt: null, OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } });
  }

  private async approved(db: Db, ownerId: string, viewerId: string): Promise<boolean> {
    return !!await db.user.findFirst({ where: { AND: [{ id: ownerId }, this.approvedConnectionOwner(viewerId)] }, select: { id: true } });
  }

  private approvedConnectionOwner(viewerId: string): Prisma.UserWhereInput {
    return {
      ...this.eligibleFollowPeer(viewerId), id: { not: viewerId },
      OR: [
        { matchesLow: { some: { status: "ACTIVE", userHighId: viewerId } } },
        { matchesHigh: { some: { status: "ACTIVE", userLowId: viewerId } } },
        { followsReceived: { some: { status: "APPROVED", requesterId: viewerId } } },
      ],
    };
  }

  private async canView(db: Db, story: PrivateStory, viewerId: string, now = new Date()): Promise<boolean> {
    return (await this.visibleStoryIds(db, [story], viewerId, now)).has(story.id);
  }

  // One policy for single reads and bounded feed/list batches. All context is
  // freshly loaded for this call, including grants and affirmative consent.
  private async visibleStoryIds(db: Db, stories: PrivateStory[], viewerId: string, now = new Date()): Promise<Set<string>> {
    const active = stories.filter(story => story.deletedAt === null
      && (activeStory(story, now) || (story.ownerId === viewerId && story.savedAt != null))
      && (!story.mediaObjectKey || this.isProcessedMedia(story)));
    if (!active.length) return new Set();
    const viewer = await db.user.findFirst({
      where: { id: viewerId, status: "ACTIVE", deletedAt: null, isShadowBanned: false },
      select: { id: true, privateCommunity: { select: { optedInCommunities: true } } },
    });
    if (!viewer) return new Set();
    const visible = new Set(active.filter(story => story.ownerId === viewerId).map(story => story.id));
    const candidates = active.filter(story => story.ownerId !== viewerId && activeStory(story, now) && story.moderationStatus === "APPROVED");
    if (!candidates.length) return visible;
    const [owners, grants] = await Promise.all([
      db.user.findMany({ where: { AND: [
        { id: { in: [...new Set(candidates.map(story => story.ownerId))] } }, this.approvedConnectionOwner(viewerId),
      ] }, select: { id: true } }),
      db.privateStoryGrant.findMany({ where: { recipientId: viewerId, storyId: { in: candidates.map(story => story.id) } }, select: { storyId: true } }),
    ]);
    const approvedOwners = new Set(owners.map(owner => owner.id));
    const grantedStories = new Set(grants.map(grant => grant.storyId));
    for (const story of candidates) {
      if (approvedOwners.has(story.ownerId) && grantedStories.has(story.id)
        && (!story.communityFilter || viewer.privateCommunity?.optedInCommunities.includes(story.communityFilter))) visible.add(story.id);
    }
    return visible;
  }

  // Background jobs and notification reads use the same policy as Story detail.
  // They do not pass through the HTTP rollout guard.
  async canAccess(viewerId: string, storyId: string, db: Db = this.prisma): Promise<boolean> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storyId)) return false;
    const flag = await this.flags.execute({ key: "private_stories.v1", userId: viewerId });
    if (!flag.enabled) return false;
    const story = await db.privateStory.findUnique({ where: { id: storyId } });
    return !!story && await this.canView(db, story, viewerId);
  }

  private async persistShared(db: PrismaTransactionalClient, storyId: string, recipientIds: string[]) {
    const notices: Array<{ notification: Notification; created: boolean }> = [];
    for (const recipientId of recipientIds) {
      if (!await this.canAccess(recipientId, storyId, db)) continue;
      notices.push(await this.notificationIntents.persist(db, {
        userId: recipientId, type: "SYSTEM", title: "New update",
        body: "A private Story is available in Yariva.",
        data: { route: "private-story", storyId }, dedupeKey: `private-story:${storyId}:${recipientId}`,
      }));
    }
    return notices;
  }

  private async dispatchShared(storyId: string, notices: Array<{ notification: Notification; created: boolean }>): Promise<void> {
    for (const notice of notices) {
      try {
        if (!await this.canAccess(notice.notification.userId, storyId)) continue;
        await this.notificationIntents.dispatchPersisted(notice);
      } catch (error) {
        // The committed PENDING row remains recoverable if dispatch exits/fails.
        this.logger.error(`Failed to dispatch Story notification ${notice.notification.id}`, error);
      }
    }
  }

  private isProcessedMedia(story: PrivateStory) {
    return !!story.mediaObjectKey && story.mediaBucket === this.storageConfig.bucketMessageAttachments
      && new RegExp(`^private-stories/${story.ownerId}/[0-9a-f-]{36}\\.clean\\.(jpeg|png|webp|mp4)$`).test(story.mediaObjectKey);
  }

  async connections(ownerId: string, db: Db = this.prisma) {
    if (!await this.activeUser(db, ownerId)) throw invalid("Account is not active");
    const [matches, follows] = await Promise.all([
      db.match.findMany({ where: { status: "ACTIVE", OR: [{ userLowId: ownerId }, { userHighId: ownerId }] }, select: { userLowId: true, userHighId: true }, take: 501 }),
      db.privateFollow.findMany({ where: { ownerId, status: "APPROVED" }, select: { requesterId: true }, take: 501 }),
    ]);
    if (matches.length > 500 || follows.length > 500) throw invalid("Too many approved connections for one Story");
    const ids = [...new Set([...matches.map(m => m.userLowId === ownerId ? m.userHighId : m.userLowId), ...follows.map(f => f.requesterId)])];
    if (ids.length > PRIVATE_STORY_POLICY.maxRecipients) throw invalid("Too many approved connections for one Story");
    const allowed: string[] = [];
    for (const id of ids) if (await this.activeUser(db, id) && await this.approved(db, ownerId, id)) allowed.push(id);
    const people = await db.user.findMany({ where: { id: { in: allowed } }, select: { id: true, profile: { select: { displayName: true } } } });
    return { recipientIds: allowed, people: people.map(person => ({ id: person.id, displayName: person.profile?.displayName ?? "Connection" })) };
  }

  private async resolveAudience(ownerId: string, body: AudienceDto, db: Db): Promise<string[]> {
    if (body.audienceRule === "ALL_APPROVED" && body.recipientIds?.length) throw invalid("All approved cannot include selected recipients");
    if (body.audienceRule === "SELECTED" && !body.recipientIds?.length) throw invalid("Select at least one approved connection");
    const ids = body.audienceRule === "ALL_APPROVED"
      ? (await this.connections(ownerId, db)).recipientIds
      : [...new Set(body.recipientIds ?? [])];
    if (ids.length > PRIVATE_STORY_POLICY.maxRecipients) throw invalid("Too many recipients");
    for (const id of ids) if (!await this.activeUser(db, id) || !await this.approved(db, ownerId, id)) throw invalid("Select approved connections only");
    if (body.communityFilter) {
      const memberships = await db.privateCommunityPreference.findMany({ where: { userId: { in: ids }, optedInCommunities: { has: body.communityFilter } }, select: { userId: true } });
      const optedIn = new Set(memberships.map(m => m.userId));
      return ids.filter(id => optedIn.has(id));
    }
    return ids;
  }

  async preview(ownerId: string, body: AudienceDto) {
    if (!await this.activeUser(this.prisma, ownerId)) throw invalid("Account is not active");
    const ids = await this.resolveAudience(ownerId, body, this.prisma);
    return { eligibleCount: ids.length, audienceRule: body.audienceRule, communityFilter: body.communityFilter ?? null, lifetimeHours: PRIVATE_STORY_POLICY.lifetimeHours };
  }

  async create(ownerId: string, body: CreatePrivateStoryDto) {
    if (!await this.activeUser(this.prisma, ownerId)) throw invalid("Account is not active");
    const text = body.text?.trim() ?? "";
    if (!text && !body.media) throw invalid("Add a photo, video or words before sharing");
    await this.resolveAudience(ownerId, body, this.prisma);
    if (body.media) await this.validateMedia(ownerId, body.media);
    const processed = body.media ? await this.sanitizeMedia(ownerId, body.media) : null;
    try {
      const result = await this.prisma.$transaction(async tx => {
      const ids = await this.resolveAudience(ownerId, body, tx);
      const story = await tx.privateStory.create({ data: {
        ownerId, text, audienceRule: body.audienceRule, communityFilter: body.communityFilter ?? null,
        moderationStatus: processed ? "PENDING" : "APPROVED",
        ...(processed ? { mediaBucket: processed.bucket, mediaObjectKey: processed.objectKey,
          mediaMimeType: processed.mimeType, mediaSizeBytes: processed.sizeBytes } : {}),
        expiresAt: new Date(Date.now() + PRIVATE_STORY_POLICY.lifetimeHours * 3_600_000),
        grants: { create: ids.map(recipientId => ({ recipientId })) },
      } });
      const notices = story.moderationStatus === "APPROVED" ? await this.persistShared(tx, story.id, ids) : [];
      return { response: { story: this.map(story), eligibleCount: ids.length }, notices };
      }, { isolationLevel: "Serializable" });
      await this.dispatchShared(result.response.story.id, result.notices);
      return result.response;
    } catch (error) {
      if (processed) await this.storage.deleteObject({ bucket: processed.bucket, objectKey: processed.objectKey }).catch(cleanupError =>
        this.logger.error(`Failed to remove unpublished Story media ${processed.objectKey}`, cleanupError));
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
        throw new AppException(409, ERROR_CODES.VALIDATION_FAILED, "Connections changed; review the Story audience and try again");
      throw error;
    } finally {
      if (body.media && processed) await this.storage.deleteObject({ bucket: processed.bucket, objectKey: body.media.objectKey }).catch(cleanupError =>
        this.logger.error(`Failed to remove Story upload ${body.media!.objectKey}`, cleanupError));
    }
  }

  private map(story: PrivateStory) {
    return { id: story.id, ownerId: story.ownerId, text: story.text, mediaMimeType: story.mediaMimeType, moderationStatus: story.moderationStatus, audienceRule: story.audienceRule,
      savedAt: story.savedAt?.toISOString() ?? null, communityFilter: story.communityFilter, expiresAt: story.expiresAt.toISOString(), createdAt: story.createdAt.toISOString() };
  }

  private mapForViewer(story: PrivateStory, viewerId: string) {
    const mapped = this.map(story);
    // The author's private community choice is not part of recipient content.
    return viewerId === story.ownerId ? mapped : { ...mapped, communityFilter: null, savedAt: null };
  }

  private async mediaUrl(story: PrivateStory, viewerId: string, maxSeconds: number) {
    if (story.moderationStatus === "REJECTED" || !story.mediaBucket || !story.mediaObjectKey) return null;
    // Owner archives do not extend previously issued audience URLs. Round down
    // so a signed GET cannot outlive the 24-hour audience window.
    const seconds = story.ownerId === viewerId && story.savedAt != null ? maxSeconds
      : Math.min(maxSeconds, Math.floor((story.expiresAt.getTime() - Date.now()) / 1000));
    return seconds > 0 ? this.storage.createPresignedGetObject({ bucket: story.mediaBucket,
      objectKey: story.mediaObjectKey, expiresInSeconds: seconds, noStore: true }) : null;
  }

  async detail(viewerId: string, storyId: string) {
    const story = await this.prisma.privateStory.findUnique({ where: { id: storyId }, include: { owner: { select: { profile: { select: { displayName: true } } } } } });
    if (!story || !await this.canView(this.prisma, story, viewerId)) throw missing();
    const recipientIds = viewerId === story.ownerId
      ? (await this.prisma.privateStoryGrant.findMany({ where: { storyId }, select: { recipientId: true } })).map(grant => grant.recipientId)
      : undefined;
    const mediaUrl = await this.mediaUrl(story, viewerId, 60);
    return { story: { ...this.mapForViewer(story, viewerId), ownerName: story.owner.profile?.displayName ?? "Connection", mediaUrl }, ...(recipientIds ? { recipientIds } : {}) };
  }

  async assertReportable(viewerId: string, storyId: string, ownerId: string) {
    const story = await this.prisma.privateStory.findUnique({ where: { id: storyId } });
    if (!story || story.ownerId !== ownerId || !await this.canView(this.prisma, story, viewerId)) throw missing();
  }

  async mine(ownerId: string, cursor?: string, saved = false) {
    if (!await this.activeUser(this.prisma, ownerId)) return { items: [], nextCursor: null };
    const parsed = cursor ? decodeDateIdCursor(cursor) : null;
    if (parsed && (!Number.isFinite(Date.parse(parsed.createdAt)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)))
      throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
    const rows = await this.prisma.privateStory.findMany({
      where: { ownerId, deletedAt: null, ...(saved ? { savedAt: { not: null } } : { expiresAt: { gt: new Date() } }),
        ...(parsed ? { OR: [{ createdAt: { lt: new Date(parsed.createdAt) } }, { createdAt: new Date(parsed.createdAt), id: { lt: parsed.id } }] } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PRIVATE_STORY_POLICY.pageSize + 1,
    });
    const page = rows.slice(0, PRIVATE_STORY_POLICY.pageSize);
    const visibleIds = await this.visibleStoryIds(this.prisma, page, ownerId);
    const visible = page.filter(row => visibleIds.has(row.id));
    // Advance over consumed candidates, including denied media rows. Signing
    // and returning content still require the shared policy on every page.
    const last = page.at(-1);
    const nextCursor = rows.length > PRIVATE_STORY_POLICY.pageSize && last
      ? encodeDateIdCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;
    return { items: await Promise.all(visible.map(async row => ({ ...this.map(row), previewUrl: row.moderationStatus !== "REJECTED" && this.isProcessedMedia(row) && row.mediaMimeType?.startsWith("image/") && row.mediaBucket && row.mediaObjectKey
      ? await this.mediaUrl(row, ownerId, 10) : null }))), nextCursor };
  }

  async feed(viewerId: string, cursor?: string) {
    if (!await this.activeUser(this.prisma, viewerId)) return { items: [], nextCursor: null };
    const parsed = cursor ? decodeDateIdCursor(cursor) : null;
    if (parsed && (!Number.isFinite(Date.parse(parsed.createdAt)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id))) throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
    // Scan past revoked/blocked grants until the page contains visible items.
    // A single post-filtered DB page can otherwise hide later valid Stories.
    const visible: Array<ReturnType<PrivateStoriesService["map"]> & { ownerName: string; previewUrl: string | null }> = [];
    let position = parsed;
    let hasMore = false;
    let scannedPages = 0;
    do {
      scannedPages += 1;
      const rows = await this.prisma.privateStory.findMany({
        where: { ownerId: { not: viewerId }, deletedAt: null, expiresAt: { gt: new Date() }, grants: { some: { recipientId: viewerId } },
          ...(position ? { OR: [{ createdAt: { lt: new Date(position.createdAt) } }, { createdAt: new Date(position.createdAt), id: { lt: position.id } }] } : {}) },
        include: { owner: { select: { profile: { select: { displayName: true } } } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
      });
      hasMore = rows.length === 50;
      const visibleIds = await this.visibleStoryIds(this.prisma, rows, viewerId);
      for (const [index, row] of rows.entries()) {
        position = { createdAt: row.createdAt.toISOString(), id: row.id };
        if (!visibleIds.has(row.id)) continue;
        // A rail preview is an ephemeral, read-only URL minted only after the
        // same policy as detail. It is never a permanent media field or cache.
        const previewUrl = row.mediaMimeType?.startsWith("image/") && row.mediaBucket && row.mediaObjectKey
          ? await this.mediaUrl(row, viewerId, 10) : null;
        visible.push({ ...this.mapForViewer(row, viewerId), ownerName: row.owner.profile?.displayName ?? "Connection", previewUrl });
        if (visible.length === PRIVATE_STORY_POLICY.pageSize) {
          hasMore = index < rows.length - 1 || rows.length === 50;
          break;
        }
      }
      if (visible.length === PRIVATE_STORY_POLICY.pageSize) break;
      if (!hasMore) break;
    } while (position && scannedPages < 5);
    return { items: visible, nextCursor: hasMore && position ? encodeDateIdCursor(position) : null };
  }

  async update(ownerId: string, storyId: string, body: UpdatePrivateStoryDto) {
    try {
      return await this.prisma.$transaction(async tx => {
      const story = await tx.privateStory.findUnique({ where: { id: storyId }, include: { grants: { select: { recipientId: true } } } });
      if (!story || story.ownerId !== ownerId || !activeStory(story, new Date())) throw missing();
      if (!await this.activeUser(tx, ownerId)) throw missing();
      if (story.moderationStatus === "REJECTED") throw invalid("This Story did not pass review. Delete it before sharing a new Story.");
      const ids = await this.resolveAudience(ownerId, body, tx);
      const old = new Set(story.grants.map(g => g.recipientId));
      const filterBroadened = !!story.communityFilter && body.communityFilter !== story.communityFilter;
      if ((ids.some(id => !old.has(id)) || filterBroadened) && body.confirmAudienceExpansion !== true) throw invalid("Review and confirm the new audience");
      const text = body.text?.trim();
      if (body.text !== undefined && !text && !story.mediaObjectKey) throw invalid("Story text cannot be empty");
      await tx.privateStoryGrant.deleteMany({ where: { storyId } });
      await tx.privateStoryGrant.createMany({ data: ids.map(recipientId => ({ storyId, recipientId })) });
      const contentChanged = body.text !== undefined && text !== story.text;
      const updated = await tx.privateStory.update({ where: { id: storyId }, data: {
        ...(body.text !== undefined ? { text: text ?? "" } : {}),
        ...(contentChanged && story.mediaObjectKey ? { moderationStatus: "PENDING", moderatedAt: null } : {}),
        audienceRule: body.audienceRule, communityFilter: body.communityFilter ?? null,
      } });
      return { story: this.map(updated), eligibleCount: ids.length };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
        throw new AppException(409, ERROR_CODES.VALIDATION_FAILED, "Story changed; review its audience and try again");
      throw error;
    }
  }

  async setSaved(ownerId: string, storyId: string, saved: boolean) {
    return this.prisma.$transaction(async tx => {
      // Serialize repeated saves, unsaves and deletion on the same row. Read
      // the deadline after acquiring the lock, not before waiting for it.
      await tx.$queryRaw`SELECT "id" FROM "PrivateStory" WHERE "id" = ${storyId}::uuid FOR UPDATE`;
      const story = await tx.privateStory.findUnique({ where: { id: storyId } });
      if (!story || story.ownerId !== ownerId || story.deletedAt || !await this.activeUser(tx, ownerId)) throw missing();
      const now = new Date();
      if (saved && !story.savedAt && !activeStory(story, now)) throw missing();
      const updated = await tx.privateStory.update({ where: { id: storyId },
        data: { savedAt: saved ? story.savedAt ?? now : null } });
      return { story: this.map(updated) };
    });
  }

  async remove(ownerId: string, storyId: string) {
    if (!await this.activeUser(this.prisma, ownerId)) throw missing();
    // Repeated deletion is safe, but a different owner still sees not-found.
    const result = await this.prisma.privateStory.updateMany({ where: { id: storyId, ownerId, deletedAt: null }, data: { deletedAt: new Date(), savedAt: null } });
    if (!result.count && !await this.prisma.privateStory.findFirst({ where: { id: storyId, ownerId, deletedAt: { not: null } }, select: { id: true } })) throw missing();
    return { deleted: true };
  }

  // Administrative review is separate from recipient access. It requires the
  // existing ADMIN guard, and content reads/decisions are auditable.
  async moderationQueue(cursor?: string) {
    const parsed = cursor ? decodeDateIdCursor(cursor) : null;
    if (parsed && (!Number.isFinite(Date.parse(parsed.createdAt)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)))
      throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
    const rows = await this.prisma.privateStory.findMany({
      where: { moderationStatus: "PENDING", deletedAt: null, expiresAt: { gt: new Date() },
        ...(parsed ? { OR: [{ createdAt: { lt: new Date(parsed.createdAt) } }, { createdAt: new Date(parsed.createdAt), id: { lt: parsed.id } }] } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PRIVATE_STORY_POLICY.pageSize + 1,
      select: { id: true, mediaMimeType: true, createdAt: true, expiresAt: true },
    });
    const items = rows.slice(0, PRIVATE_STORY_POLICY.pageSize);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > PRIVATE_STORY_POLICY.pageSize && last
      ? encodeDateIdCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null };
  }

  async moderationPreview(storyId: string, actor: ReviewActor) {
    const story = await this.prisma.privateStory.findUnique({ where: { id: storyId } });
    if (!story || !activeStory(story, new Date())) throw missing();
    await this.audit.write({ ...actor, action: "private-story.moderation.view", entityType: "PrivateStory", entityId: story.id, targetUserId: story.ownerId });
    const mediaUrl = this.isProcessedMedia(story) && story.mediaBucket && story.mediaObjectKey
      ? await this.storage.createPresignedGetObject({ bucket: story.mediaBucket, objectKey: story.mediaObjectKey, expiresInSeconds: 60, noStore: true }) : null;
    return { story: { id: story.id, text: story.text, mediaMimeType: story.mediaMimeType,
      moderationStatus: story.moderationStatus, updatedAt: story.updatedAt, expiresAt: story.expiresAt, mediaUrl } };
  }

  async review(storyId: string, input: { decision: "APPROVED" | "REJECTED"; expectedUpdatedAt: string; reason?: string | null }, actor: ReviewActor): Promise<boolean> {
    const story = await this.prisma.privateStory.findUnique({ where: { id: storyId } });
    if (!story || !activeStory(story, new Date()) || story.moderationStatus === "REJECTED"
      || story.updatedAt.toISOString() !== input.expectedUpdatedAt) return false;
    if (input.decision === "APPROVED" && (story.moderationStatus !== "PENDING"
      || (story.mediaObjectKey && !this.isProcessedMedia(story)))) return false;
    const applied = await this.prisma.$transaction(async tx => {
      const update = await tx.privateStory.updateMany({
        where: { id: story.id, moderationStatus: story.moderationStatus, updatedAt: story.updatedAt,
          text: story.text, deletedAt: null, expiresAt: { gt: new Date() } },
        data: { moderationStatus: input.decision, moderatedAt: new Date() },
      });
      if (!update.count) return null;
      await this.audit.write({ ...actor, action: input.decision === "APPROVED" ? "private-story.moderation.approve" : "private-story.moderation.reject",
        entityType: "PrivateStory", entityId: story.id, targetUserId: story.ownerId,
        metadata: { provider: "admin-manual-review", reason: input.reason ?? null } }, tx);
      if (input.decision !== "APPROVED") return [];
      const grants = await tx.privateStoryGrant.findMany({ where: { storyId }, select: { recipientId: true } });
      return this.persistShared(tx, storyId, grants.map(grant => grant.recipientId));
    });
    if (applied !== null) await this.dispatchShared(storyId, applied);
    return applied !== null;
  }

  async getCommunity(userId: string) {
    const record = await this.prisma.privateCommunityPreference.findUnique({ where: { userId } });
    return { identifyAs: record?.identifyAs ?? [], connectWith: record?.connectWith ?? [], optedInCommunities: record?.optedInCommunities ?? [], selfDescription: record?.selfDescription ?? null };
  }

  async saveCommunity(userId: string, body: PrivateCommunityDto) {
    if (!await this.activeUser(this.prisma, userId)) throw invalid("Account is not active");
    const unique = (values: string[]) => [...new Set(values)];
    await this.prisma.privateCommunityPreference.upsert({ where: { userId }, create: { userId, identifyAs: unique(body.identifyAs), connectWith: unique(body.connectWith), optedInCommunities: unique(body.optedInCommunities), selfDescription: body.selfDescription?.trim() || null }, update: { identifyAs: unique(body.identifyAs), connectWith: unique(body.connectWith), optedInCommunities: unique(body.optedInCommunities), selfDescription: body.selfDescription?.trim() || null } });
    return this.getCommunity(userId);
  }

  async requestFollow(requesterId: string, ownerId: string) {
    if (requesterId === ownerId || !await this.activeUser(this.prisma, requesterId) || !await this.activeUser(this.prisma, ownerId) || await this.blocked(this.prisma, requesterId, ownerId)) throw invalid("Cannot request this connection");
    const follow = await this.prisma.privateFollow.upsert({ where: { requesterId_ownerId: { requesterId, ownerId } }, create: { requesterId, ownerId }, update: {} });
    return { status: follow.status };
  }

  async followStatus(requesterId: string, ownerId: string) {
    if (requesterId === ownerId || !await this.activeUser(this.prisma, requesterId)
      || !await this.activeUser(this.prisma, ownerId) || await this.blocked(this.prisma, requesterId, ownerId))
      return { status: "NONE" };
    const follow = await this.prisma.privateFollow.findUnique({ where: { requesterId_ownerId: { requesterId, ownerId } }, select: { status: true } });
    return { status: follow?.status ?? "NONE" };
  }

  // A private social graph: only the authenticated owner may request these totals.
  async followSummary(userId: string) {
    if (!await this.activeUser(this.prisma, userId)) return { followers: 0, following: 0, requests: 0 };
    const eligible = this.eligibleFollowPeer(userId);
    const [followers, following, requests] = await Promise.all([
      this.prisma.privateFollow.count({ where: { ownerId: userId, status: "APPROVED", requester: eligible } }),
      this.prisma.privateFollow.count({ where: { requesterId: userId, status: "APPROVED", owner: eligible } }),
      this.prisma.privateFollow.count({ where: { ownerId: userId, status: "PENDING", requester: eligible } }),
    ]);
    return { followers, following, requests };
  }

  private eligibleFollowPeer(userId: string) {
    return {
      status: "ACTIVE" as const, deletedAt: null, isShadowBanned: false,
      blocksInitiated: { none: { blockedId: userId, deletedAt: null } },
      blocksReceived: { none: { blockerId: userId, deletedAt: null } },
    };
  }

  async followList(userId: string, direction: "followers" | "following", cursor?: string) {
    if (!await this.activeUser(this.prisma, userId)) return { items: [], nextCursor: null };
    const parsed = cursor ? decodeDateIdCursor(cursor) : null;
    if (parsed && (!Number.isFinite(Date.parse(parsed.createdAt)) || !/^[0-9a-f-]{36}$/i.test(parsed.id)))
      throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
    const incoming = direction === "followers";
    const idKey = incoming ? "requesterId" : "ownerId";
    const rows = await this.prisma.privateFollow.findMany({
      where: { ...(incoming ? { ownerId: userId } : { requesterId: userId }), status: "APPROVED",
        ...(incoming ? { requester: this.eligibleFollowPeer(userId) } : { owner: this.eligibleFollowPeer(userId) }),
        ...(parsed ? { OR: [{ createdAt: { lt: new Date(parsed.createdAt) } }, { createdAt: new Date(parsed.createdAt), [idKey]: { lt: parsed.id } }] } : {}) },
      orderBy: [{ createdAt: "desc" }, { [idKey]: "desc" }], take: PRIVATE_STORY_POLICY.pageSize + 1,
      select: { requesterId: true, ownerId: true, createdAt: true,
        requester: { select: { profile: { select: followProfileFields }, photos: { where: { deletedAt: null, moderationStatus: "APPROVED", purpose: "PROFILE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { bucket: true, objectKey: true } } } },
        owner: { select: { profile: { select: followProfileFields }, photos: { where: { deletedAt: null, moderationStatus: "APPROVED", purpose: "PROFILE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { bucket: true, objectKey: true } } } } },
    });
    const page = rows.slice(0, PRIVATE_STORY_POLICY.pageSize);
    const matches = await findActiveMatchPartnerIds(this.prisma, userId, page.map(row => row[idKey]));
    const items = await Promise.all(page.map(async (row) => {
      const otherId = row[idKey];
      const other = incoming ? row.requester : row.owner;
      const photo = other.photos[0];
      return { userId: otherId, displayName: other.profile?.displayName ?? "Connection",
        city: canViewProfileField(other.profile, "location", matches.has(otherId)) ? other.profile?.city ?? null : null,
        photoUrl: photo ? await this.storage.createPresignedGetObject({ disclosure: { viewerId: userId, ownerId: otherId }, bucket: photo.bucket, objectKey: photo.objectKey }) : null };
    }));
    const last = page.at(-1);
    return { items, nextCursor: rows.length > PRIVATE_STORY_POLICY.pageSize && last
      ? encodeDateIdCursor({ createdAt: last.createdAt.toISOString(), id: last[idKey] }) : null };
  }

  async followRequests(ownerId: string, cursor?: string) {
    if (!await this.activeUser(this.prisma, ownerId)) return { items: [], nextCursor: null };
    const parsed = cursor ? decodeDateIdCursor(cursor) : null;
    if (parsed && (!Number.isFinite(Date.parse(parsed.createdAt)) || !/^[0-9a-f-]{36}$/i.test(parsed.id)))
      throw new AppException(400, ERROR_CODES.INVALID_CURSOR, "Invalid cursor");
    const rows = await this.prisma.privateFollow.findMany({ where: { ownerId, status: "PENDING", requester: this.eligibleFollowPeer(ownerId),
      ...(parsed ? { OR: [{ createdAt: { lt: new Date(parsed.createdAt) } }, { createdAt: new Date(parsed.createdAt), requesterId: { lt: parsed.id } }] } : {}) },
      orderBy: [{ createdAt: "desc" }, { requesterId: "desc" }], take: PRIVATE_STORY_POLICY.pageSize + 1,
      select: { requesterId: true, createdAt: true, requester: { select: { profile: { select: followProfileFields }, photos: { where: { deletedAt: null, moderationStatus: "APPROVED", purpose: "PROFILE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { bucket: true, objectKey: true } } } } } });
    const page = rows.slice(0, PRIVATE_STORY_POLICY.pageSize);
    const matches = await findActiveMatchPartnerIds(this.prisma, ownerId, page.map(row => row.requesterId));
    const items = await Promise.all(page.map(async (row) => {
      const { profile, photos: [photo] } = row.requester;
      return { requesterId: row.requesterId, displayName: profile?.displayName ?? "Connection", createdAt: row.createdAt,
        city: canViewProfileField(profile, "location", matches.has(row.requesterId)) ? profile?.city ?? null : null,
        photoUrl: photo ? await this.storage.createPresignedGetObject({ disclosure: { viewerId: ownerId, ownerId: row.requesterId }, bucket: photo.bucket, objectKey: photo.objectKey }) : null };
    }));
    const last = page.at(-1);
    return { items, nextCursor: rows.length > PRIVATE_STORY_POLICY.pageSize && last
      ? encodeDateIdCursor({ createdAt: last.createdAt.toISOString(), id: last.requesterId }) : null };
  }

  async approveFollow(ownerId: string, requesterId: string) {
    if (!await this.activeUser(this.prisma, ownerId) || !await this.activeUser(this.prisma, requesterId) || await this.blocked(this.prisma, ownerId, requesterId)) throw missing();
    const result = await this.prisma.privateFollow.updateMany({ where: { ownerId, requesterId, status: "PENDING" }, data: { status: "APPROVED" } });
    if (!result.count) throw missing();
    return { status: "APPROVED" };
  }

  async revokeFollow(ownerId: string, requesterId: string) {
    await this.prisma.privateFollow.deleteMany({ where: { ownerId, requesterId } });
    return { revoked: true };
  }

  async cancelFollow(requesterId: string, ownerId: string) {
    await this.prisma.privateFollow.deleteMany({ where: { requesterId, ownerId } });
    return { revoked: true };
  }
}
