import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { DomainEventPublisher } from "../../../common/services/domain-event.publisher";
import type { Prisma } from "../../../generated/prisma/client";

@Injectable()
export class DuoRevocationService {
  constructor(private readonly prisma: PrismaService, private readonly events: DomainEventPublisher) {}

  async publishClosed(where: Prisma.ConversationWhereInput) {
    const closed = await this.prisma.conversation.findMany({
      where: { AND: [where, { duoMatchId: { not: null }, status: { not: "ACTIVE" } }] },
      select: { id: true, status: true, closedReason: true, members: { select: { userId: true } } },
    });
    for (const conversation of closed) await this.events.publishSafely("conversation.closed", {
      conversationId: conversation.id, status: conversation.status, closedReason: conversation.closedReason,
      recipientUserIds: conversation.members.map(member => member.userId),
    });
  }
}
