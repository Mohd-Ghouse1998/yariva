import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

export interface MediaViewer { viewerId: string; ownerId: string }
export const mediaPairKey = (a: string, b: string) => `media:${[a, b].sort().join(":")}`;

/** One authority for every public profile, Scene, avatar and Vibe rendition. */
@Injectable()
export class MediaDisclosureService {
  constructor(private readonly prisma: PrismaService) {}

  async mayDisclose({ viewerId, ownerId }: MediaViewer): Promise<boolean> {
    if (viewerId === ownerId) return true;
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mediaPairKey(viewerId, ownerId)}, 0))`;
      const [userLowId, userHighId] = [viewerId, ownerId].sort() as [string, string];
      const relationship = await tx.blindRelationship.findUnique({ where: { userLowId_userHighId: { userLowId, userHighId } } });
      if (relationship && !relationship.revealedAt) return false;
      // Exposure is conservative: issuance means potentially seen, even if the
      // user never opens the screen. It cannot later become a blind introduction.
      await tx.mediaExposure.createMany({ data: [{ viewerId, ownerId }], skipDuplicates: true });
      return true;
    });
  }
}
