import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AuditLogService } from "../../../common/services/audit-log.service";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { publicHttpsUrl } from "../../../common/utils/public-https-url";
import { encodeScopedCursor, decodeScopedCursor } from "../../../common/utils/scoped-cursor.util";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { Prisma, type ReviewedVenue } from "../../../generated/prisma/client";
import type { AdminVenueQueryDto, ReviewedVenueImportItemDto } from "../dto/admin-reviewed-venues.dto";

@Injectable()
export class AdminReviewedVenuesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}
  async list(query: AdminVenueQueryDto) {
    const city = query.city.trim();
    if (!city) invalid("Choose a city");
    const scope = `admin-venues:${city.toLowerCase()}`;
    const after = query.cursor ? decodeScopedCursor(query.cursor, scope) : null;
    const limit = query.limit ?? 20;
    const rows = await this.prisma.reviewedVenue.findMany({ where: { city: { equals: city, mode: "insensitive" },
      ...(after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
    const items = rows.slice(0, limit), last = items.at(-1);
    return { items: items.map(mapAdminVenue), nextCursor: rows.length > limit && last ? encodeScopedCursor(last, scope) : null };
  }
  async get(id: string) {
    const row = await this.prisma.reviewedVenue.findUnique({ where: { id } });
    if (!row) throw new AppException(404, ERROR_CODES.VENUE_NOT_FOUND, "Place not found");
    return { venue: mapAdminVenue(row) };
  }
  async import(actor: AuthContext, items: ReviewedVenueImportItemDto[]) {
    if (!items.length || items.length > 20 || new Set(items.map(row => row.id)).size !== items.length) invalid("Import 1–20 distinct place IDs");
    // Validate before acquiring any locks; all edits are atomic and auditable.
    const rows = items.map(input => ({ input, data: curateVenueData(input) })).sort((a, b) => a.input.id.localeCompare(b.input.id));
    try {
      const result = await this.prisma.$transaction(async tx => {
        const saved: ReviewedVenue[] = [];
        for (const { input, data } of rows) {
          await tx.$queryRaw`SELECT id FROM "ReviewedVenue" WHERE id = ${input.id}::uuid FOR UPDATE`;
          const existing = await tx.reviewedVenue.findUnique({ where: { id: input.id } });
          if ((existing?.version ?? 0) !== input.expectedVersion) throw new AppException(409, ERROR_CODES.CONFLICT, "Place changed; reload before importing");
          const venue = existing ? await tx.reviewedVenue.update({ where: { id: input.id }, data: { ...data, version: { increment: 1 } } })
            : await tx.reviewedVenue.create({ data: { ...data, id: input.id } });
          await this.audit.write({ actorUserId: actor.user.id, actorSessionId: actor.session.id, action: "reviewed-venue.curate", entityType: "ReviewedVenue", entityId: venue.id,
            metadata: { version: venue.version, reviewStatus: venue.reviewStatus, operationalStatus: venue.operationalStatus } }, tx);
          saved.push(venue);
        }
        return saved;
      });
      return { items: result.map(mapAdminVenue) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppException(409, ERROR_CODES.CONFLICT, "A concurrent import created this place; reload");
      throw error;
    }
  }
}
function invalid(message: string): never { throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, message); }
function curateVenueData(input: ReviewedVenueImportItemDto) {
  const text = (value: string) => value.trim() || invalid("Place details cannot be blank");
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) invalid("Use a two-letter country code");
  const source = input.reviewSource ? publicHttpsUrl(input.reviewSource) : null;
  const reviewedAt = input.reviewedAt ? new Date(input.reviewedAt) : null;
  if (reviewedAt && (!Number.isFinite(reviewedAt.getTime()) || reviewedAt > new Date())) invalid("Review date must not be in the future");
  if (input.reviewStatus === "REVIEWED" && (!source || !reviewedAt)) invalid("Reviewed places need a public source and review date");
  const min = input.priceMinPerPerson ?? null, max = input.priceMaxPerPerson ?? null;
  if ((min === null) !== (max === null) || (min !== null && (max === null || max < min))) invalid("Provide both INR spending bounds, or leave both unknown");
  if (input.photoUrl && !input.photoRights?.trim()) invalid("Record photo usage rights before adding a photo");
  return { name: text(input.name), address: text(input.address), publicLocality: text(input.publicLocality), city: text(input.city), countryCode,
    latitude: input.latitude, longitude: input.longitude, reviewStatus: input.reviewStatus, reviewSource: source, reviewedAt, operationalStatus: input.operationalStatus,
    category: input.category, priceMinPerPerson: min, priceMaxPerPerson: max, currency: "INR", photoUrl: input.photoUrl ? publicHttpsUrl(input.photoUrl) : null,
    photoRights: input.photoUrl ? text(input.photoRights!) : null, deletedAt: input.deleted ? new Date() : null };
}
function mapAdminVenue(row: ReviewedVenue) {
  return { ...row, latitude: Number(row.latitude), longitude: Number(row.longitude), rating: row.rating == null ? null : Number(row.rating) };
}
