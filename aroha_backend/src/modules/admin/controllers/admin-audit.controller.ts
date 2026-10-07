import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminAuditLogService } from "../application/admin.services";
import { AdminAuditLogQueryDto } from "../dto/admin.dto";
import { AdminRoleGuard } from "../policies/admin-role.guard";

@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("admin/audit-logs")
export class AdminAuditController {
  constructor(private readonly adminAuditLogService: AdminAuditLogService) {}

  @Get()
  async list(@Query() query: AdminAuditLogQueryDto) {
    return this.adminAuditLogService.list(query);
  }
}
