import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import { DuoDiscoveryService } from "../application/duo-discovery.service";
import { WingmanService } from "../application/wingman.service";
import {
  DuoDiscoveryQueryDto,
  DuoVoteDto,
} from "../dto/duo-discovery.dto";
import {
  CreateWingmanInvitationDto,
  RespondWingmanInvitationDto,
  WingmanSceneConsentDto,
} from "../dto/wingman.dto";

@Controller("wingman")
export class WingmanController {
  constructor(
    private readonly wingman: WingmanService,
    private readonly duoDiscovery: DuoDiscoveryService,
  ) {}

  @Get("capabilities")
  capabilities(@CurrentUser() user: AuthContext["user"]) {
    return this.wingman.capabilities(user.id);
  }

  @Get("me")
  getMine(@CurrentUser() user: AuthContext["user"]) {
    return this.wingman.getMine(user.id);
  }

  @Get("discovery")
  discover(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: DuoDiscoveryQueryDto,
  ) {
    return this.duoDiscovery.discover({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Post("discovery/:targetPartyId/vote")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  vote(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("targetPartyId", new ParseUUIDPipe()) targetPartyId: string,
    @Body() payload: DuoVoteDto,
  ) {
    return this.duoDiscovery.vote({
      userId: user.id,
      sessionId: session.id,
      targetPartyId,
      decision: payload.decision,
    });
  }

  @Post("invitations")
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  invite(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() payload: CreateWingmanInvitationDto,
  ) {
    return this.wingman.invite({
      userId: user.id,
      sessionId: session.id,
      payload,
    });
  }

  @Post("invitations/accept")
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() payload: RespondWingmanInvitationDto,
  ) {
    return this.wingman.accept({
      userId: user.id,
      sessionId: session.id,
      payload,
    });
  }

  @Post("invitations/decline")
  @HttpCode(200)
  decline(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() payload: RespondWingmanInvitationDto,
  ) {
    return this.wingman.decline({
      userId: user.id,
      sessionId: session.id,
      payload,
    });
  }

  @Post("invitations/:invitationId/cancel")
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("invitationId", new ParseUUIDPipe()) invitationId: string,
  ) {
    return this.wingman.cancel({
      userId: user.id,
      sessionId: session.id,
      invitationId,
    });
  }

  @Post("parties/:partyId/leave")
  @HttpCode(200)
  leave(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("partyId", new ParseUUIDPipe()) partyId: string,
  ) {
    return this.wingman.leave({
      userId: user.id,
      sessionId: session.id,
      partyId,
    });
  }

  @Post("parties/:partyId/scene-consent")
  @HttpCode(200)
  consentScene(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("partyId", new ParseUUIDPipe()) partyId: string,
    @Body() payload: WingmanSceneConsentDto,
  ) {
    return this.wingman.consentScene({
      userId: user.id,
      sessionId: session.id,
      partyId,
      payload,
    });
  }
}
