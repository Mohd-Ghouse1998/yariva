import type { NotificationChannel, NotificationStatus, NotificationType } from "./enums";

export type { NotificationType };

export interface NotificationDto {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown>;
  actor: {
    userId: string;
    displayName: string | null;
  } | null;
  status: NotificationStatus;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationPageDto {
  items: NotificationDto[];
  nextCursor: string | null;
}
