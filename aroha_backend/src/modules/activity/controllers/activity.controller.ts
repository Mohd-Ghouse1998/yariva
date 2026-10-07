import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { ActivityService } from "../application/activity.service";
import { ActivityPreferencesDto } from "../dto/activity.dto";
@Controller("activity")
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}
  @Get("me") summary(@CurrentUser() user: AuthContext["user"]) {
    return this.activity.summary(user.id);
  }
  @Patch("preferences") preferences(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: ActivityPreferencesDto,
  ) {
    return this.activity.preferences(user.id, body);
  }
  @Get("recap") recap(@CurrentUser() user: AuthContext["user"]) {
    return this.activity.recap(user.id);
  }
}
