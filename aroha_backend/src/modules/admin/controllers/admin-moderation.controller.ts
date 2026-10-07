import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { AdminModerationService } from "../application/admin.services";
import {
  AdminApplyModerationActionDto,
  AdminAssignModerationCaseDto,
  AdminModerationCaseQueryDto,
} from "../dto/admin.dto";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/moderation/cases")
export class AdminModerationController {
  constructor(private readonly adminModerationService: AdminModerationService) {}

  @Get()
  async list(@Query() query: AdminModerationCaseQueryDto) {
    return this.adminModerationService.listCases(query);
  }

  @Get(":caseId")
  async get(@Param("caseId", new ParseUUIDPipe()) caseId: string) {
    return this.adminModerationService.getCase(caseId);
  }

  @Post(":caseId/assign")
  async assign(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() body: AdminAssignModerationCaseDto,
    @Req() request: Request,
  ) {
    return this.adminModerationService.assignCase({
      actor: { user, session, tokenJti: "" },
      caseId,
      assignedAdminUserId: body.assignedAdminUserId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Post(":caseId/action")
  async action(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("caseId", new ParseUUIDPipe()) caseId: string,
    @Body() body: AdminApplyModerationActionDto,
    @Req() request: Request,
  ) {
    return this.adminModerationService.applyAction({
      actor: { user, session, tokenJti: "" },
      caseId,
      action: body.action,
      actionNotes: body.actionNotes ?? null,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

}
