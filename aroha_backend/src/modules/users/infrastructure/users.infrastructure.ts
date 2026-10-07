import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../../database/prisma/prisma.transaction";
import type {
  ProfilePhoto,
  User,
  UserCommunicationPreference,
  UserDiscoveryPreference,
  UserIntent,
  UserProfile,
} from "../../../generated/prisma/client";

export interface UserMeRecord extends User {
  profile: UserProfile | null;
  discoveryPreference: UserDiscoveryPreference | null;
  communicationPreference: UserCommunicationPreference | null;
  intents: Pick<UserIntent, "intent">[];
  photos: Pick<ProfilePhoto, "id" | "isPrimary">[];
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });
  }

  async findMeById(userId: string): Promise<UserMeRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        profile: true,
        discoveryPreference: true,
        communicationPreference: true,
        intents: {
          where: {
            deletedAt: null,
          },
          select: {
            intent: true,
          },
        },
        photos: {
          where: {
            deletedAt: null,
            purpose: "PROFILE",
            moderationStatus: "APPROVED",
          },
          select: {
            id: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  async touchLastActiveAt(
    userId: string,
    lastActiveAt: Date,
    executor?: PrismaTransactionalClient,
  ): Promise<void> {
    const db = executor ?? this.prisma;

    await db.user.update({
      where: {
        id: userId,
      },
      data: {
        lastActiveAt,
      },
    });
  }
}
