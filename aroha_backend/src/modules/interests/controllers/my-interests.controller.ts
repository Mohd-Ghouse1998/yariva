import { Body, Controller, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UpdateUserInterestsService } from "../application/interests.services";
import {
  UpdateMyInterestsDto,
  type UpdateMyInterestsResponseDto,
} from "../dto/interests.dto";

@Controller("users/me")
export class MyInterestsController {
  constructor(
    private readonly updateUserInterestsService: UpdateUserInterestsService,
  ) {}

  @Put("interests")
  async update(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateMyInterestsDto,
    @Req() request: Request,
  ): Promise<UpdateMyInterestsResponseDto> {
    return this.updateUserInterestsService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
