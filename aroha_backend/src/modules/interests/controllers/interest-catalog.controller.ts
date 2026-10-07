import { Controller, Get, Query } from "@nestjs/common";
import { ListInterestTagsService } from "../application/interests.services";
import { InterestCatalogQueryDto, type InterestTagPageDto } from "../dto/interests.dto";

@Controller("interests")
export class InterestCatalogController {
  constructor(
    private readonly listInterestTagsService: ListInterestTagsService,
  ) {}

  @Get()
  async list(
    @Query() query: InterestCatalogQueryDto,
  ): Promise<InterestTagPageDto> {
    return this.listInterestTagsService.execute({
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 100) : 50,
      search: query.search,
    });
  }
}
