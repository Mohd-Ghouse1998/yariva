import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Get,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { ReadMessageAttachmentService } from "../application/read-message-attachment.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  CreateConversationMessageDto,
  FinalizeMessageAttachmentDto,
  InitiateMessageAttachmentUploadDto,
  type InitiateMessageAttachmentUploadResponseDto,
  type MessageResponseDto,
  UpdateMessageDto,
} from "../dto/messages.dto";
import {
  DeleteMessageService,
  EditMessageService,
  FinalizeAttachmentMessageService,
  InitiateMessageAttachmentUploadService,
  SendMessageService,
} from "../application/messages.services";

@Controller()
export class MessagesController {
  constructor(
    private readonly initiateMessageAttachmentUploadService: InitiateMessageAttachmentUploadService,
    private readonly sendMessageService: SendMessageService,
    private readonly finalizeAttachmentMessageService: FinalizeAttachmentMessageService,
    private readonly editMessageService: EditMessageService,
    private readonly deleteMessageService: DeleteMessageService,
    private readonly readAttachmentService: ReadMessageAttachmentService,
  ) {}

  @Get("messages/:messageId/attachment")
  async readAttachment(
    @CurrentUser() user: AuthContext["user"],
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const object = await this.readAttachmentService.execute(user.id, messageId, request.get("range"));
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (object.ContentRange) {
      response.status(206);
      response.setHeader("Content-Range", object.ContentRange);
    }
    if (!(object.Body instanceof Readable)) throw new Error("Media stream is unavailable");
    return new StreamableFile(object.Body, {
      type: object.ContentType ?? "application/octet-stream",
      length: object.ContentLength,
      disposition: "inline",
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("messages/attachments/upload")
  async initiateAttachmentUpload(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: InitiateMessageAttachmentUploadDto,
  ): Promise<InitiateMessageAttachmentUploadResponseDto> {
    return this.initiateMessageAttachmentUploadService.execute({
      userId: user.id,
      payload: body,
    });
  }

  @Post("conversations/:conversationId/messages")
  async sendTextMessage(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() body: CreateConversationMessageDto,
    @Req() request: Request,
  ): Promise<MessageResponseDto> {
    return this.sendMessageService.execute({
      userId: user.id,
      conversationId,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("messages/attachments/finalize")
  async finalizeAttachment(
    @CurrentUser() user: AuthContext["user"],
    @Body() body: FinalizeMessageAttachmentDto,
    @Req() request: Request,
  ): Promise<MessageResponseDto> {
    return this.finalizeAttachmentMessageService.execute({
      userId: user.id,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Patch("messages/:messageId")
  async editMessage(
    @CurrentUser() user: AuthContext["user"],
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Body() body: UpdateMessageDto,
    @Req() request: Request,
  ): Promise<MessageResponseDto> {
    return this.editMessageService.execute({
      userId: user.id,
      messageId,
      payload: body,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }

  @Delete("messages/:messageId")
  @HttpCode(204)
  async deleteMessage(
    @CurrentUser() user: AuthContext["user"],
    @Param("messageId", new ParseUUIDPipe()) messageId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.deleteMessageService.execute({
      userId: user.id,
      messageId,
      metadata: {
        ipAddress: request.ip ?? null,
        userAgent: request.get("user-agent") ?? null,
      },
    });
  }
}
