import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import { AppLogger } from "../../common/logger/app-logger.service";
import { NotificationIntentService } from "../notifications/application/notification-intent.service";
import type { SocialNoticeData } from "./social-notice-data";
import { canReadSocialNotice } from "./social-notice-policy";

export type PersistedSocialNotices = Awaited<ReturnType<NotificationIntentService["persist"]>>[];

const titles = {
  "circle-message": "New Circle message",
  "circle-membership": "Circle membership update",
  "circle-activity": "Circle activity update",
  "connection-check-in": "Connection check-in",
};

@Injectable()
export class SocialNoticeService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationIntentService,
    private readonly logger: AppLogger) {}

  async persist(tx: PrismaTransactionalClient, data: SocialNoticeData, recipients: string[]): Promise<PersistedSocialNotices> {
    const key = this.key(data);
    return Promise.all([...new Set(recipients)].map((userId) => this.notifications.persist(tx, {
      userId, type: data.route === "circle-message" ? "NEW_MESSAGE" : "SYSTEM",
      title: titles[data.route], body: "Open Yariva to see the update.", data, dedupeKey: `${key}:${userId}`,
    })));
  }

  async dispatch(notices: PersistedSocialNotices) {
    await Promise.all(notices.map(async (result) => {
      try {
        const { userId, data } = result.notification;
        if (await canReadSocialNotice(this.prisma, userId, data as Record<string, unknown>)) {
          await this.notifications.dispatchPersisted(result);
        }
      } catch (error) {
        // A committed mutation still succeeds. Durable pending rows are recovered by the worker.
        this.logger.error(`Failed to dispatch social notice ${result.notification.id}`, error instanceof Error ? error.stack : undefined);
      }
    }));
  }

  private key(data: SocialNoticeData): string {
    switch (data.route) {
      case "circle-message": return `${data.route}:${data.messageId}`;
      case "circle-membership": return `${data.route}:${data.circleId}:${data.requestId}:${data.status}`;
      case "circle-activity": return `${data.route}:${data.activityId}:${data.status}:${"requestId" in data ? data.requestId : data.version}`;
      case "connection-check-in": return `${data.route}:${data.conversationId}:${data.kind}:${data.version}`;
    }
  }
}
