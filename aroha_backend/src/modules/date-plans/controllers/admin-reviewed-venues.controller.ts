import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { AdminRoleGuard } from "../../admin/policies/admin-role.guard";
import { AdminReviewedVenuesService } from "../application/admin-reviewed-venues.service";
import { AdminVenueQueryDto, CurateReviewedVenueDto, ImportReviewedVenuesDto } from "../dto/admin-reviewed-venues.dto";

@Controller("admin/reviewed-venues")
@UseGuards(AdminRoleGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AdminReviewedVenuesController {
  constructor(private readonly venues: AdminReviewedVenuesService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  list(@Query() query: AdminVenueQueryDto) { return this.venues.list(query); }
  @Get(":id") @Header("Cache-Control", "private, no-store")
  get(@Param("id", new ParseUUIDPipe()) id: string) { return this.venues.get(id); }
  @Put(":id")
  async curate(@CurrentUser() user: AuthContext["user"], @CurrentSession() session: AuthContext["session"], @Param("id", new ParseUUIDPipe()) id: string, @Body() body: CurateReviewedVenueDto) {
    const result = await this.venues.import({ user, session, tokenJti: "" }, [{ ...body, id }]);
    return { venue: result.items[0] };
  }
  @Post("import")
  import(@CurrentUser() user: AuthContext["user"], @CurrentSession() session: AuthContext["session"], @Body() body: ImportReviewedVenuesDto) {
    return this.venues.import({ user, session, tokenJti: "" }, body.items);
  }
}
