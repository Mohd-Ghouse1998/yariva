import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { AdminUsersService } from "../application/admin.services";
import { AdminUserActionDto } from "../dto/admin.dto";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get(":userId")
  async get(@Param("userId", new ParseUUIDPipe()) userId: string) {
    return this.adminUsersService.getUser(userId);
  }

  @Post(":userId/action")
  async action(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() body: AdminUserActionDto,
    @Req() request: Request,
  ) {
    return this.adminUsersService.applyUserAction({
      actor: { user, session, tokenJti: "" },
      userId,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
