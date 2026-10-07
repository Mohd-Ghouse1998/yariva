import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentSession } from "../../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  AcceptCallService,
  CallAccessService,
  CallSessionReaderService,
  CallCleanupStaleService,
  DeclineCallService,
  EndCallService,
  InitiateCallService,
} from "../application/calls.services";
import {
  EmptyCallActionDto,
  EndCallDto,
  InitiateCallDto,
} from "../dto/calls.dto";
import { CallSessionRepository } from "../infrastructure/calls.infrastructure";
import { CallParticipantPolicy } from "../policies/call-participant.policy";
import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

@Controller("calls")
export class CallsController {
  constructor(
    private readonly initiateCallService: InitiateCallService,
    private readonly acceptCallService: AcceptCallService,
    private readonly declineCallService: DeclineCallService,
    private readonly endCallService: EndCallService,
    private readonly repository: CallSessionRepository,
    private readonly reader: CallSessionReaderService,
    private readonly participant: CallParticipantPolicy,
    private readonly cleanup: CallCleanupStaleService,
    private readonly access: CallAccessService,
  ) {}

  @Get("pending")
  async pending(@CurrentUser() user: AuthContext["user"]) {
    const call = await this.repository.findPendingInvitation(user.id);
    if (!call || !(await this.access.isLive(call.id))) return { invitation: null };
    return { invitation: { call: this.reader.mapCall(call), otherUser: await this.reader.getOtherUserForViewer(call.matchId, user.id), iceServers: this.reader.getIceServers() } };
  }

  @Get(":callId")
  async getCall(@CurrentUser() user: AuthContext["user"], @Param("callId", new ParseUUIDPipe()) callId: string) {
    const call = await this.repository.findByIdForUser(callId, user.id);
    this.participant.assertParticipant(user.id, call);
    await this.cleanup.execute({ callId });
    const latest = await this.repository.findByIdForUser(callId, user.id);
    this.participant.assertParticipant(user.id, latest);
    if (["RINGING", "ACCEPTED", "CONNECTING", "CONNECTED"].includes(latest.status) && !(await this.access.isLive(callId))) {
      throw new AppException(409, ERROR_CODES.CALL_PERMISSION_DENIED, "Call permissions have changed");
    }
    return { call: this.reader.mapCall(latest) };
  }

  @Post()
  async initiateCall(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Body() body: InitiateCallDto,
    @Req() request: Request,
  ) {
    return this.initiateCallService.execute({
      userId: user.id,
      sessionId: session.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Post(":callId/accept")
  @HttpCode(HttpStatus.OK)
  async acceptCall(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("callId", new ParseUUIDPipe()) callId: string,
    @Body() _body: EmptyCallActionDto,
    @Req() request: Request,
  ) {
    return this.acceptCallService.execute({
      userId: user.id,
      sessionId: session.id,
      callId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Post(":callId/decline")
  @HttpCode(HttpStatus.OK)
  async declineCall(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("callId", new ParseUUIDPipe()) callId: string,
    @Body() _body: EmptyCallActionDto,
    @Req() request: Request,
  ) {
    return this.declineCallService.execute({
      userId: user.id,
      sessionId: session.id,
      callId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Post(":callId/end")
  @HttpCode(HttpStatus.OK)
  async endCall(
    @CurrentUser() user: AuthContext["user"],
    @CurrentSession() session: AuthContext["session"],
    @Param("callId", new ParseUUIDPipe()) callId: string,
    @Body() body: EndCallDto,
    @Req() request: Request,
  ) {
    return this.endCallService.execute({
      userId: user.id,
      sessionId: session.id,
      callId,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
