import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  ListNotificationsService,
  MarkNotificationReadService,
} from "../application/notifications.services";
import type {
  NotificationPageDto,
  NotificationResponseDto,
} from "../dto/notifications.dto";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly listNotificationsService: ListNotificationsService,
    private readonly markNotificationReadService: MarkNotificationReadService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async list(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<NotificationPageDto> {
    return this.listNotificationsService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @Post(":notificationId/read")
  @Header("Cache-Control", "private, no-store")
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AuthContext["user"],
    @Param("notificationId", new ParseUUIDPipe()) notificationId: string,
  ): Promise<NotificationResponseDto> {
    return this.markNotificationReadService.execute({
      userId: user.id,
      notificationId,
    });
  }
}

