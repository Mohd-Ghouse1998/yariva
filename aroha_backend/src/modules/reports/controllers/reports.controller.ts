import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  CreateReportService,
  ListMyReportsService,
} from "../application/reports.services";
import type {
  CreateReportResponseDto,
  ReportPageDto,
} from "../dto/reports.dto";
import { CreateReportDto } from "../dto/reports.dto";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly createReportService: CreateReportService,
    private readonly listMyReportsService: ListMyReportsService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() body: CreateReportDto,
    @Req() request: Request,
  ): Promise<CreateReportResponseDto> {
    return this.createReportService.execute({
      actor: { user, session, tokenJti: "" },
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Get("me")
  async listMine(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<ReportPageDto> {
    return this.listMyReportsService.execute({
      reporterUserId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }
}
