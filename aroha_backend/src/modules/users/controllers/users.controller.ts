import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { GetMeService } from "../application/users.services";
import type { GetMeResponseDto } from "../dto/users.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly getMeService: GetMeService) {}

  @Get("me")
  async getMe(
    @CurrentUser() user: AuthContext["user"],
  ): Promise<GetMeResponseDto> {
    return this.getMeService.execute(user.id);
  }
}
