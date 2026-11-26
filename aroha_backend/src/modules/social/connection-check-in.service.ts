import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import type { ConversationCheckIn, Prisma } from "../../generated/prisma/client";
import { mediaPairKey } from "../../integrations/object-storage/media-disclosure.service";
import { isSocialIntent } from "../discovery/domain/discovery.domain";
import { EvaluateFeatureFlagService } from "../feature-flags/application/feature-flags.services";
import {
  CHECK_IN_FLAG, CIRCLES_FLAG, FIRST_CONNECTIONS_FLAG, acceptsIntent, conflict,
  isFirstConnectionsEligible, socialUser, unavailable, type SocialUser,
} from "./social-access";
import { activeCheckInMatch, clearInvalidAgreement } from "./intent-consent";
import type { SetConnectionIntentDto, SetVibeTogetherDto } from "./social.dto";
import type { SocialNoticeData } from "./social-notice-data";
import { SocialNoticeService } from "./social-notice.service";

const prompts = [
  "How do you like to spend a free weekend?",
  "What is one activity you would like to try?",
];

@Injectable()
export class ConnectionCheckInService {
  constructor(private readonly prisma: PrismaService, private readonly flags: EvaluateFeatureFlagService,
    private readonly notices: SocialNoticeService) {}

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

  private async write(
    userId: string, id: string,
    fn: (
      row: ConversationCheckIn | null, side: "low" | "high", tx: PrismaTransactionalClient,
      match: NonNullable<Awaited<ReturnType<typeof activeCheckInMatch>>>,
    ) => Promise<ConversationCheckIn | null>,
  ) {
    const match = await activeCheckInMatch(this.prisma, userId, id);
    if (!match) unavailable();
    const { response, notices } = await this.prisma.$transaction(async (tx) => {
      const pair = mediaPairKey(match.userLowId, match.userHighId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pair}, 0))`;
      await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await activeCheckInMatch(tx, userId, id);
      if (!current) unavailable();
      const row = await clearInvalidAgreement(tx, await tx.conversationCheckIn.findUnique({ where: { conversationId: id } }), current);
      const side = current.userLowId === userId ? "low" : "high";
      const next = await fn(row, side, tx, current);
      const peerId = side === "low" ? current.userHighId : current.userLowId;
      const notice = this.notice(id, this.present(row, current, peerId), this.present(next, current, peerId));
      return {
        response: this.present(next, current, userId),
        notices: notice ? await this.notices.persist(tx, notice, [peerId]) : [],
      };
    });
    await this.notices.dispatch(notices);
    return response;
  }

  private notice(conversationId: string, before: ReturnType<ConnectionCheckInService["present"]>,
    next: ReturnType<ConnectionCheckInService["present"]>): SocialNoticeData | null {
    if (next.intent.version !== before.intent.version &&
        (next.intent.pending !== before.intent.pending || next.intent.common !== before.intent.common)) {
      return { route: "connection-check-in", conversationId,
        kind: next.intent.pending && !before.intent.common ? "intent-invite" : "intent-update", version: next.intent.version };
    }
    if (next.vibe.state === before.vibe.state) return null;
    if (next.vibe.state === "CAN_ACCEPT" || next.vibe.state === "SHARED") {
      return { route: "connection-check-in", conversationId,
        kind: next.vibe.state === "CAN_ACCEPT" ? "vibe-invite" : "vibe-complete", version: next.vibe.version };
    }
    return null;
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
