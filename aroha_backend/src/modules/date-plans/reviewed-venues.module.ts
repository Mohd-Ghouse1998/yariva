import { AdminReviewedVenuesController } from "./controllers/admin-reviewed-venues.controller";
import { AdminReviewedVenuesService } from "./application/admin-reviewed-venues.service";
import { AdminRoleGuard } from "../admin/policies/admin-role.guard";
import { AuditLogService } from "../../common/services/audit-log.service";
import { Module } from "@nestjs/common";
import { ReviewedVenuesService } from "./application/reviewed-venues.service";

@Module({
  controllers: [AdminReviewedVenuesController],
  providers: [ReviewedVenuesService, AdminReviewedVenuesService, AdminRoleGuard, AuditLogService],
  exports: [ReviewedVenuesService],
})
export class ReviewedVenuesModule {}
