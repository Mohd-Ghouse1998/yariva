import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { randomBytes, randomUUID } from "node:crypto";
import objectStorageConfig from "../../../config/object-storage.config";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { decodeDateIdCursor, encodeDateIdCursor } from "../../../common/utils/cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type { PrivateStory } from "../../../generated/prisma/client";
import { activeStory, PRIVATE_STORY_POLICY } from "../domain/private-story.policy";
import type { AudienceDto, CreatePrivateStoryDto, InitiatePrivateStoryMediaDto, PrivateCommunityDto, PrivateStoryMediaDto, UpdatePrivateStoryDto } from "../dto/private-stories.dto";

type Db = PrismaService | PrismaTransactionalClient;
const missing = () => new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "Private Story not found");
const invalid = (message: string) => new AppException(400, ERROR_CODES.VALIDATION_FAILED, message);

@Injectable()
export class PrivateStoriesService {
  constructor(private readonly prisma: PrismaService, private readonly storage: ObjectStorageService,
    @Inject(objectStorageConfig.KEY) private readonly storageConfig: ConfigType<typeof objectStorageConfig>) {}

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

  private async activeUser(db: Db, userId: string): Promise<boolean> {
    return !!await db.user.findFirst({ where: { id: userId, status: "ACTIVE", deletedAt: null, isShadowBanned: false }, select: { id: true } });
  }

  private async blocked(db: Db, a: string, b: string): Promise<boolean> {
    return !!await db.block.findFirst({ where: { deletedAt: null, OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } });
  }

  private async approved(db: Db, ownerId: string, viewerId: string): Promise<boolean> {
    if (ownerId === viewerId || await this.blocked(db, ownerId, viewerId)) return false;
    const [match, follow] = await Promise.all([
      db.match.findFirst({ where: { status: "ACTIVE", OR: [{ userLowId: ownerId, userHighId: viewerId }, { userLowId: viewerId, userHighId: ownerId }] }, select: { id: true } }),
      db.privateFollow.findUnique({ where: { requesterId_ownerId: { requesterId: viewerId, ownerId } }, select: { status: true } }),
    ]);
    return !!match || follow?.status === "APPROVED";
  }

  private async canView(db: Db, story: PrivateStory, viewerId: string, now = new Date()): Promise<boolean> {
    if (story.ownerId === viewerId) return await this.activeUser(db, viewerId) && activeStory(story, now);
    if (!activeStory(story, now) || !await this.activeUser(db, story.ownerId) || !await this.activeUser(db, viewerId)) return false;
    if (!await this.approved(db, story.ownerId, viewerId)) return false;
    const grant = await db.privateStoryGrant.findUnique({ where: { storyId_recipientId: { storyId: story.id, recipientId: viewerId } }, select: { storyId: true } });
    if (!grant) return false;
    if (!story.communityFilter) return true;
    const preference = await db.privateCommunityPreference.findUnique({ where: { userId: viewerId }, select: { optedInCommunities: true } });
    return preference?.optedInCommunities.includes(story.communityFilter) ?? false;
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
    if (body.media) await this.validateMedia(ownerId, body.media);
    return this.prisma.$transaction(async tx => {
      const ids = await this.resolveAudience(ownerId, body, tx);
      const story = await tx.privateStory.create({ data: {
        ownerId, text, audienceRule: body.audienceRule, communityFilter: body.communityFilter ?? null,
        ...(body.media ? { mediaBucket: this.storageConfig.bucketMessageAttachments, mediaObjectKey: body.media.objectKey,
          mediaMimeType: body.media.mimeType, mediaSizeBytes: body.media.sizeBytes } : {}),
        expiresAt: new Date(Date.now() + PRIVATE_STORY_POLICY.lifetimeHours * 3_600_000),
        grants: { create: ids.map(recipientId => ({ recipientId })) },
      } });
      return { story: this.map(story), eligibleCount: ids.length };
    }, { isolationLevel: "Serializable" });
  }

  private map(story: PrivateStory) {
    return { id: story.id, ownerId: story.ownerId, text: story.text, mediaMimeType: story.mediaMimeType, audienceRule: story.audienceRule,
      communityFilter: story.communityFilter, expiresAt: story.expiresAt.toISOString(), createdAt: story.createdAt.toISOString() };
  }

  private mapForViewer(story: PrivateStory, viewerId: string) {
    const mapped = this.map(story);
    // The author's private community choice is not part of recipient content.
    return viewerId === story.ownerId ? mapped : { ...mapped, communityFilter: null };
  }

  async detail(viewerId: string, storyId: string) {
    const story = await this.prisma.privateStory.findUnique({ where: { id: storyId }, include: { owner: { select: { profile: { select: { displayName: true } } } } } });
    if (!story || !await this.canView(this.prisma, story, viewerId)) throw missing();
    const recipientIds = viewerId === story.ownerId
      ? (await this.prisma.privateStoryGrant.findMany({ where: { storyId }, select: { recipientId: true } })).map(grant => grant.recipientId)
      : undefined;
    const mediaUrl = story.mediaBucket && story.mediaObjectKey
      ? await this.storage.createPresignedGetObject({ bucket: story.mediaBucket, objectKey: story.mediaObjectKey, expiresInSeconds: 60, noStore: true })
      : null;
    return { story: { ...this.mapForViewer(story, viewerId), ownerName: story.owner.profile?.displayName ?? "Connection", mediaUrl }, ...(recipientIds ? { recipientIds } : {}) };
  }

  async assertReportable(viewerId: string, storyId: string, ownerId: string) {
    const story = await this.prisma.privateStory.findUnique({ where: { id: storyId } });
    if (!story || story.ownerId !== ownerId || !await this.canView(this.prisma, story, viewerId)) throw missing();
  }

  async mine(ownerId: string) {
    if (!await this.activeUser(this.prisma, ownerId)) return { items: [] };
    const rows = await this.prisma.privateStory.findMany({ where: { ownerId, deletedAt: null, expiresAt: { gt: new Date() } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PRIVATE_STORY_POLICY.pageSize });
    return { items: await Promise.all(rows.map(async row => ({ ...this.map(row), previewUrl: row.mediaMimeType?.startsWith("image/") && row.mediaBucket && row.mediaObjectKey
      ? await this.storage.createPresignedGetObject({ bucket: row.mediaBucket, objectKey: row.mediaObjectKey, expiresInSeconds: 10, noStore: true }) : null }))) };
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
    do {
      const rows = await this.prisma.privateStory.findMany({
        where: { ownerId: { not: viewerId }, deletedAt: null, expiresAt: { gt: new Date() }, grants: { some: { recipientId: viewerId } },
          ...(position ? { OR: [{ createdAt: { lt: new Date(position.createdAt) } }, { createdAt: new Date(position.createdAt), id: { lt: position.id } }] } : {}) },
        include: { owner: { select: { profile: { select: { displayName: true } } } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
      });
      hasMore = rows.length === 50;
      for (const [index, row] of rows.entries()) {
        position = { createdAt: row.createdAt.toISOString(), id: row.id };
        if (!await this.canView(this.prisma, row, viewerId)) continue;
        // A rail preview is an ephemeral, read-only URL minted only after the
        // same policy as detail. It is never a permanent media field or cache.
        const previewUrl = row.mediaMimeType?.startsWith("image/") && row.mediaBucket && row.mediaObjectKey
          ? await this.storage.createPresignedGetObject({ bucket: row.mediaBucket, objectKey: row.mediaObjectKey, expiresInSeconds: 10, noStore: true }) : null;
        visible.push({ ...this.mapForViewer(row, viewerId), ownerName: row.owner.profile?.displayName ?? "Connection", previewUrl });
        if (visible.length === PRIVATE_STORY_POLICY.pageSize) {
          hasMore = index < rows.length - 1 || rows.length === 50;
          break;
        }
      }
      if (visible.length === PRIVATE_STORY_POLICY.pageSize) break;
      if (!hasMore) break;
    } while (position);
    return { items: visible, nextCursor: hasMore && position ? encodeDateIdCursor(position) : null };
  }

  async update(ownerId: string, storyId: string, body: UpdatePrivateStoryDto) {
    return this.prisma.$transaction(async tx => {
      const story = await tx.privateStory.findUnique({ where: { id: storyId }, include: { grants: { select: { recipientId: true } } } });
      if (!story || story.ownerId !== ownerId || !activeStory(story, new Date())) throw missing();
      const ids = await this.resolveAudience(ownerId, body, tx);
      const old = new Set(story.grants.map(g => g.recipientId));
      const filterBroadened = !!story.communityFilter && body.communityFilter !== story.communityFilter;
      if ((ids.some(id => !old.has(id)) || filterBroadened) && body.confirmAudienceExpansion !== true) throw invalid("Review and confirm the new audience");
      const text = body.text?.trim();
      if (body.text !== undefined && !text && !story.mediaObjectKey) throw invalid("Story text cannot be empty");
      await tx.privateStoryGrant.deleteMany({ where: { storyId } });
      await tx.privateStoryGrant.createMany({ data: ids.map(recipientId => ({ storyId, recipientId })) });
      const updated = await tx.privateStory.update({ where: { id: storyId }, data: { ...(body.text !== undefined ? { text: text ?? "" } : {}), audienceRule: body.audienceRule, communityFilter: body.communityFilter ?? null } });
      return { story: this.map(updated), eligibleCount: ids.length };
    }, { isolationLevel: "Serializable" });
  }

  async remove(ownerId: string, storyId: string) {
    const result = await this.prisma.privateStory.updateMany({ where: { id: storyId, ownerId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!result.count) throw missing();
    return { deleted: true };
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
        requester: { select: { profile: { select: { displayName: true, city: true } }, photos: { where: { deletedAt: null, moderationStatus: "APPROVED", purpose: "PROFILE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { bucket: true, objectKey: true } } } },
        owner: { select: { profile: { select: { displayName: true, city: true } }, photos: { where: { deletedAt: null, moderationStatus: "APPROVED", purpose: "PROFILE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { bucket: true, objectKey: true } } } } },
    });
    const page = rows.slice(0, PRIVATE_STORY_POLICY.pageSize);
    const items = await Promise.all(page.map(async (row) => {
      const otherId = incoming ? row.requesterId : row.ownerId;
      const other = incoming ? row.requester : row.owner;
      const photo = other.photos[0];
      return { userId: otherId, displayName: other.profile?.displayName ?? "Connection", city: other.profile?.city ?? null,
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
      select: { requesterId: true, createdAt: true, requester: { select: { profile: { select: { displayName: true, city: true } }, photos: { where: { deletedAt: null, moderationStatus: "APPROVED", purpose: "PROFILE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { bucket: true, objectKey: true } } } } } });
    const page = rows.slice(0, PRIVATE_STORY_POLICY.pageSize);
    const items = await Promise.all(page.map(async (row) => {
      const photo = row.requester.photos[0];
      return { requesterId: row.requesterId, displayName: row.requester.profile?.displayName ?? "Connection", city: row.requester.profile?.city ?? null, createdAt: row.createdAt,
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
