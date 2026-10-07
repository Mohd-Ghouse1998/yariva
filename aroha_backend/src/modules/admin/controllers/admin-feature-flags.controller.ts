import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UpsertFeatureFlagDto } from "../../feature-flags/dto/feature-flags.dto";
import { AdminFeatureFlagsService } from "../application/admin.services";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/feature-flags")
export class AdminFeatureFlagsController {
  constructor(
    private readonly adminFeatureFlagsService: AdminFeatureFlagsService,
  ) {}

  @Get()
  async list() {
    return this.adminFeatureFlagsService.list();
  }

  @Put(":key")
  async upsert(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("key") key: string,
    @Body() body: UpsertFeatureFlagDto,
    @Req() request: Request,
  ) {
    return this.adminFeatureFlagsService.upsert({
      actor: { user, session, tokenJti: "" },
      key,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
