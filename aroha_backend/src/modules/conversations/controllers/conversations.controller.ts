import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CursorPageQueryDto } from "../../../common/dto/cursor-page-query.dto";
import type { AuthContext } from "../../../common/types/auth-context.type";
import {
  GetConversationService,
  ListConversationMessagesService,
  ListConversationsService,
  MarkConversationReadService,
} from "../application/conversations.services";
import {
  ConversationDetailQueryDto,
  ConversationMessagePageQueryDto,
  ConversationReadRequestDto,
  type ConversationDetailResponseDto,
  type ConversationPageDto,
  type ConversationReadResponseDto,
  type MessagePageDto,
} from "../dto/conversations.dto";

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly listConversationsService: ListConversationsService,
    private readonly getConversationService: GetConversationService,
    private readonly listConversationMessagesService: ListConversationMessagesService,
    private readonly markConversationReadService: MarkConversationReadService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthContext["user"],
    @Query() query: CursorPageQueryDto,
  ): Promise<ConversationPageDto> {
    return this.listConversationsService.execute({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 50) : 20,
    });
  }

  @Get(":conversationId")
  @Header("Cache-Control", "private, no-store")
  async getById(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query() query: ConversationDetailQueryDto,
  ): Promise<ConversationDetailResponseDto> {
    return this.getConversationService.execute({
      userId: user.id,
      conversationId,
      history: query.history === "1",
    });
  }

  @Get(":conversationId/messages")
  @Header("Cache-Control", "private, no-store")
  async listMessages(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query() query: ConversationMessagePageQueryDto,
  ): Promise<MessagePageDto> {
    return this.listConversationMessagesService.execute({
      userId: user.id,
      conversationId,
      history: query.history === "1",
      cursor: query.cursor,
      limit: query.limit ? Math.min(query.limit, 100) : 50,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post(":conversationId/read")
  async markRead(
    @CurrentUser() user: AuthContext["user"],
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() body: ConversationReadRequestDto,
  ): Promise<ConversationReadResponseDto> {
    return this.markConversationReadService.execute({
      userId: user.id,
      conversationId,
      lastReadSequence: body.lastReadSequence,
    });
  }
}
