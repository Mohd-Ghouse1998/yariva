import { ConversationsModule } from "../conversations/conversations.module";
import { CallsModule } from "../calls/calls.module";
import { Module, forwardRef } from "@nestjs/common";
import { AppLogger } from "../../common/logger/app-logger.service";
import { DomainEventPublisher } from "../../common/services/domain-event.publisher";
import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";
import { SessionsModule } from "../sessions/sessions.module";
import { UsersModule } from "../users/users.module";
import {
  ConversationTypingStateService,
  GetPresenceService,
  HeartbeatPresenceService,
  PresenceRealtimeFanoutService,
  RegisterSocketService,
  SocketRegistryService,
  UnregisterSocketService,
} from "./application/presence.services";
import { PresencePolicyService } from "./domain/presence.domain";
import { PresenceGateway } from "./presence.gateway";
import { PresenceRepository } from "./infrastructure/presence.repository";
import { SocketRegistryRepository } from "./infrastructure/socket-registry.repository";
import { TypingStateRepository } from "./infrastructure/typing-state.repository";
import { PresenceDomainEventSubscriberService } from "./infrastructure/domain-event-subscriber.service";
import { WsHandshakeRateLimitPolicy } from "./policies/ws-handshake-rate-limit.policy";
import { WsSessionPolicy } from "./policies/ws-session.policy";

@Module({
  imports: [CallsModule, ConversationsModule, AuthModule, SessionsModule, UsersModule, forwardRef(() => MessagesModule)],
  providers: [
    AppLogger,
    DomainEventPublisher,
    PresenceGateway,
    SocketRegistryService,
    RegisterSocketService,
    UnregisterSocketService,
    HeartbeatPresenceService,
    GetPresenceService,
    ConversationTypingStateService,
    PresenceRealtimeFanoutService,
    PresencePolicyService,
    PresenceRepository,
    SocketRegistryRepository,
    TypingStateRepository,
    PresenceDomainEventSubscriberService,
    WsHandshakeRateLimitPolicy,
    WsSessionPolicy,
  ],
  exports: [GetPresenceService, SocketRegistryService],
})
export class PresenceModule {}
