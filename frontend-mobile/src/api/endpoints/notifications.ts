import type { CursorPageQuery } from "../../types/discovery";
import type { NotificationDto, NotificationPageDto } from "../../types/notifications";
import { http } from "../http";

export const notificationsApi = {
  list: (query: CursorPageQuery = {}) =>
    http.get<NotificationPageDto>("notifications", {
      cursor: query.cursor ?? undefined,
      limit: query.limit,
    }),
  read: (notificationId: string) =>
    http
      .post<{ notification: NotificationDto }>(
        `notifications/${notificationId}/read`,
      )
      .then((response) => response.notification),
};
