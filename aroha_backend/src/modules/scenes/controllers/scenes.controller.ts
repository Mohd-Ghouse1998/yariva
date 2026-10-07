import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { ScenesService } from "../application/scenes.services";
import {
  CreateSceneDto,
  SceneDiscoveryQueryDto,
  UpdateSceneDto,
} from "../dto/scenes.dto";

@Controller("scenes")
export class ScenesController {
  constructor(private readonly scenes: ScenesService) {}

  @Get("capabilities")
  capabilities(@CurrentUser() user: AuthContext["user"]) {
    return this.scenes.capabilities(user.id);
  }

  @Get("me")
  getMine(@CurrentUser() user: AuthContext["user"]) {
    return this.scenes.getMine(user.id);
  }

  @Get("users/:userId")
  getForUser(
    @CurrentUser() user: AuthContext["user"],
    @Param("userId", new ParseUUIDPipe()) targetUserId: string,
  ) {
    return this.scenes.getForUser(user.id, targetUserId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: CreateSceneDto,
  ) {
    return this.scenes.create(user.id, body);
  }

  @Patch(":sceneId")
  update(
    @CurrentUser() user: AuthContext["user"],
    @Param("sceneId", new ParseUUIDPipe()) sceneId: string,
    @Body() body: UpdateSceneDto,
  ) {
    return this.scenes.update(user.id, sceneId, body);
  }

  @Post(":sceneId/end")
  @HttpCode(200)
  end(
    @CurrentUser() user: AuthContext["user"],
    @Param("sceneId", new ParseUUIDPipe()) sceneId: string,
  ) {
    return this.scenes.end(user.id, sceneId);
  }

  @Post(":sceneId/renew")
  @HttpCode(200)
  renew(
    @CurrentUser() user: AuthContext["user"],
    @Param("sceneId", new ParseUUIDPipe()) sceneId: string,
  ) {
    return this.scenes.renew(user.id, sceneId);
  }

  @Get("discover")
  discover(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: SceneDiscoveryQueryDto,
  ) {
    return this.scenes.discover({ userId: user.id, cursor: query.cursor, limit: query.limit });
  }
}
