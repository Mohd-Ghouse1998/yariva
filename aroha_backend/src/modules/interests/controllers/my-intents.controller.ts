import { Body, Controller, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { UpdateUserIntentsService } from "../application/interests.services";
import {
  UpdateMyIntentsDto,
  type UpdateMyIntentsResponseDto,
} from "../dto/interests.dto";

@Controller("users/me")
export class MyIntentsController {
  constructor(
    private readonly updateUserIntentsService: UpdateUserIntentsService,
  ) {}

  @Put("intents")
  async update(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: UpdateMyIntentsDto,
    @Req() request: Request,
  ): Promise<UpdateMyIntentsResponseDto> {
    return this.updateUserIntentsService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
