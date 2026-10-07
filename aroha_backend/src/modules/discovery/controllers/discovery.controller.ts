import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { clampCuratedProfileLimit, GetDiscoveryFeedService } from "../application/discovery.services";
import type { DiscoveryFeedResponseDto } from "../dto/discovery.dto";

@Controller("discovery")
export class DiscoveryController {
  constructor(
    private readonly getDiscoveryFeedService: GetDiscoveryFeedService,
  ) {}

  @Get("feed")
  async getFeed(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<DiscoveryFeedResponseDto> {
    return this.getDiscoveryFeedService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: clampCuratedProfileLimit(query.limit),
    });
  }
}
