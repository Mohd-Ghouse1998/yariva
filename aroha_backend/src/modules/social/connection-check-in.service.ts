import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import type { ConversationCheckIn, Prisma } from "../../generated/prisma/client";
import { mediaPairKey } from "../../integrations/object-storage/media-disclosure.service";
import { isSocialIntent } from "../discovery/domain/discovery.domain";
import { EvaluateFeatureFlagService } from "../feature-flags/application/feature-flags.services";
import {
  CHECK_IN_FLAG, CIRCLES_FLAG, FIRST_CONNECTIONS_FLAG, acceptsIntent, conflict,
  isEligible, isFirstConnectionsEligible, socialUser, unavailable, type SocialUser,
} from "./social-access";
import { checkInParticipants, clearInvalidAgreement } from "./intent-consent";
import type { SetConnectionIntentDto, SetVibeTogetherDto } from "./social.dto";

const prompts = [
  "How do you like to spend a free weekend?",
  "What is one activity you would like to try?",
];

@Injectable()
export class ConnectionCheckInService {
  constructor(private readonly prisma: PrismaService, private readonly flags: EvaluateFeatureFlagService) {}

  async status(userId: string) {
    const [circles, checkIn, first] = await Promise.all([
      this.flags.execute({ key: CIRCLES_FLAG, userId }),
      this.flags.execute({ key: CHECK_IN_FLAG, userId }),
      this.flags.execute({ key: FIRST_CONNECTIONS_FLAG, userId }),
    ]);
    const user = first.enabled ? await this.prisma.user.findUnique({ where: { id: userId }, select: socialUser }) : null;
    return {
      circles: circles.enabled,
      checkIn: checkIn.enabled,
      firstConnections: isFirstConnectionsEligible(user),
    };
  }

  async get(userId: string, id: string) {
    return this.write(userId, id, async (row) => row);
  }

  async intent(userId: string, id: string, body: SetConnectionIntentDto) {
    return this.write(userId, id, async (row, side, tx, match) => {
      if ((row?.intentVersion ?? 0) !== body.version) conflict("Refresh your check-in and try again");
      const actor = side === "low" ? match.userLow : match.userHigh;
      if (body.intent && !isSocialIntent(body.intent) &&
          !actor.intents.some(({ intent }) => intent === body.intent)) {
        conflict("That intention is unavailable");
      }
      const own = side === "low" ? row?.lowIntent : row?.highIntent;
      if ((own ?? null) === body.intent) return row;
      const peerChoice = side === "low" ? row?.highIntent : row?.lowIntent;
      if (body.intent && body.intent === peerChoice &&
          (!acceptsIntent(match.userLow, match.userHigh, body.intent) ||
           !acceptsIntent(match.userHigh, match.userLow, body.intent))) {
        conflict("That intention is unavailable");
      }
      const agreed = !!row?.lowIntent && row.lowIntent === row.highIntent;
      return this.save(tx, id, row, {
        intentVersion: body.version + 1,
        ...(side === "low"
          ? { lowIntent: body.intent, ...(agreed ? { highIntent: null } : {}) }
          : { highIntent: body.intent, ...(agreed ? { lowIntent: null } : {}) }),
      });
    });
  }

  async vibe(userId: string, id: string, body: SetVibeTogetherDto) {
    return this.write(userId, id, async (row, side, tx) => {
      if (row && body.action === "ANSWER") {
        const own = side === "low" ? row.lowAnswers : row.highAnswers;
        if (own.length) {
          // Since acceptance, each participant can advance the version once.
          const submittedSince = row.vibeVersion - (row.lowAnswers.length && row.highAnswers.length ? 2 : 1);
          if (body.version >= submittedSince && body.version <= row.vibeVersion &&
              body.answers?.length === own.length && own.every((answer, i) => answer === body.answers?.[i])) {
            return row;
          }
          conflict("Your answers are already saved for this round");
        }
      }
      if ((row?.vibeVersion ?? 0) !== body.version) conflict("Refresh your prompts and try again");
      const change: Omit<Prisma.ConversationCheckInUncheckedCreateInput, "conversationId"> = { vibeVersion: body.version + 1 };
      if (body.action === "START") {
        if (row?.vibeInviterId) conflict("A prompt activity is already open");
        change.vibeInviterId = userId;
      } else {
        if (!row?.vibeInviterId) unavailable();
        if (body.action === "SKIP") {
          Object.assign(change, { vibeInviterId: null, vibeAccepted: false, lowAnswers: [], highAnswers: [] });
        } else if (body.action === "ACCEPT") {
          if (row.vibeInviterId === userId || row.vibeAccepted) conflict("Only the invited person can accept");
          change.vibeAccepted = true;
        } else {
          if (!row.vibeAccepted || !body.answers) conflict("Accept and answer both prompts to continue");
          if (side === "low") change.lowAnswers = body.answers;
          else change.highAnswers = body.answers;
        }
      }
      return this.save(tx, id, row, change);
    });
  }

  private async context(tx: PrismaTransactionalClient, userId: string, id: string) {
    const conversation = await tx.conversation.findFirst({
      where: { id, status: "ACTIVE", match: { status: "ACTIVE", OR: [{ userLowId: userId }, { userHighId: userId }] } },
      include: { match: { include: checkInParticipants } },
    });
    const match = conversation?.match;
    if (!match || !isEligible(match.userLow) || !isEligible(match.userHigh)) unavailable();
    const ids = [match.userLowId, match.userHighId];
    const rollouts = await Promise.all(ids.map((id) => this.flags.execute({ key: CHECK_IN_FLAG, userId: id })));
    if (!rollouts.every((flag) => flag.enabled) ||
        await tx.block.count({ where: { deletedAt: null, blockerId: { in: ids }, blockedId: { in: ids } } }) ||
        await tx.blindRelationship.findFirst({ where: { matchId: match.id, revealedAt: null }, select: { matchId: true } })) {
      unavailable();
    }
    return { match };
  }

  private async write(
    userId: string, id: string,
    fn: (
      row: ConversationCheckIn | null, side: "low" | "high", tx: PrismaTransactionalClient,
      match: Awaited<ReturnType<ConnectionCheckInService["context"]>>["match"],
    ) => Promise<ConversationCheckIn | null>,
  ) {
    const { match } = await this.context(this.prisma, userId, id);
    return this.prisma.$transaction(async (tx) => {
      const pair = mediaPairKey(match.userLowId, match.userHighId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pair}, 0))`;
      await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const { match: current } = await this.context(tx, userId, id);
      const row = await clearInvalidAgreement(tx, await tx.conversationCheckIn.findUnique({ where: { conversationId: id } }), current);
      const side = current.userLowId === userId ? "low" : "high";
      return this.present(await fn(row, side, tx, current), current, userId);
    });
  }

  private save(
    tx: PrismaTransactionalClient, conversationId: string, row: ConversationCheckIn | null,
    data: Omit<Prisma.ConversationCheckInUncheckedCreateInput, "conversationId">,
  ) {
    return row
      ? tx.conversationCheckIn.update({ where: { conversationId }, data })
      : tx.conversationCheckIn.create({ data: { conversationId, ...data } });
  }

  private present(row: ConversationCheckIn | null, match: { userLow: SocialUser; userHigh: SocialUser }, userId: string) {
    const side = match.userLow.id === userId ? "low" : "high";
    const own = (side === "low" ? row?.lowIntent : row?.highIntent) ?? null;
    const other = side === "low" ? row?.highIntent : row?.lowIntent;
    const common = own && own === other && acceptsIntent(match.userLow, match.userHigh, own) &&
      acceptsIntent(match.userHigh, match.userLow, own) ? own : null;
    const myAnswers = (side === "low" ? row?.lowAnswers : row?.highAnswers) ?? [];
    const theirAnswers = (side === "low" ? row?.highAnswers : row?.lowAnswers) ?? [];
    return {
      intent: { version: row?.intentVersion ?? 0, mine: own, common, pending: !own && !!other },
      vibe: {
        version: row?.vibeVersion ?? 0, prompts,
        state: !row?.vibeInviterId ? "IDLE" as const : !row.vibeAccepted ?
          row.vibeInviterId === userId ? "INVITED" as const : "CAN_ACCEPT" as const :
          myAnswers.length && theirAnswers.length ? "SHARED" as const :
          myAnswers.length ? "WAITING" as const : "ANSWER" as const,
        mine: myAnswers, theirs: myAnswers.length && theirAnswers.length ? theirAnswers : [],
      },
    };
  }
}
