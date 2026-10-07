# 4. COMPLETE NESTJS MODULE ARCHITECTURE

The backend is a modular monolith. Direct synchronous module calls are allowed only when the caller needs immediate invariant enforcement inside the same request/transaction. Secondary reactions use domain events and BullMQ.

## Global rules

- Controllers and WebSocket gateways do transport only.
- Application services own use-case orchestration and transactions.
- Domain services own invariants, permissions, and eligibility logic.
- Repositories do persistence only.
- Cross-module write coordination happens in application services, not repositories.
- Event emission happens after commit only.

## Auth Module

Purpose
- Signup, login, token refresh, logout, and credential verification.

Controllers
- `AuthController`

Application services
- `SignupService`
- `LoginService`
- `RefreshTokenService`
- `LogoutService`

Domain services
- `PasswordPolicyService`
- `CredentialVerificationService`
- `AuthEligibilityService`

Repositories
- `AuthUserReadRepository`
- `AuthSessionWriteRepository`

Policies / guards
- `LocalCredentialPolicy`
- `RefreshTokenPolicy`

Events
- `user.registered`
- `session.created`
- `session.refreshed`
- `session.revoked`

Workers
- none

Public API surface
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Internal dependencies
- Direct: `users`, `sessions`, `analytics`, `feature-flags`
- Events instead of direct call: `notifications`, `audit`

Exported providers
- `AuthContextService`
- `CredentialVerificationService`

Transaction boundary
- Signup and refresh rotation are transactional.

## Sessions Module

Purpose
- Session lifecycle, device management, push token registration, revoke flows.

Controllers
- `SessionsController`
- `PushTokensController`

Application services
- `ListSessionsService`
- `RevokeSessionService`
- `RevokeAllOtherSessionsService`
- `RegisterPushTokenService`
- `InvalidatePushTokenService`

Domain services
- `SessionRotationPolicyService`
- `DeviceSessionPolicyService`

Repositories
- `UserSessionRepository`
- `PushTokenRepository`

Policies / guards
- `SessionOwnershipPolicy`

Events
- `session.revoked`
- `push-token.registered`
- `push-token.invalidated`

Workers
- `SessionsCleanupWorker`

Public API surface
- `GET /sessions`
- `DELETE /sessions/:sessionId`
- `DELETE /sessions/others`
- `POST /push-tokens`
- `DELETE /push-tokens/:tokenId`

Internal dependencies
- Direct: `users`, `presence`
- Events instead of direct call: `notifications`, `audit`, `analytics`

Exported providers
- `SessionReaderService`
- `SessionRevocationService`
- `PushTokenReaderService`

Transaction boundary
- Session revoke and push-token reassignment are transactional.

## Users Module

Purpose
- Base account record, role/state flags, account-level admin/user reads.

Controllers
- `UsersController`

Application services
- `GetMeService`
- `GetUserStateService`
- `UpdateUserStateService`

Domain services
- `UserStatePolicyService`
- `UserEligibilityService`

Repositories
- `UserRepository`

Policies / guards
- `CurrentUserPolicy`
- `AdminUserStatePolicy`

Events
- `user.state-changed`

Workers
- none

Public API surface
- `GET /users/me`
- internal/admin account-state endpoints

Internal dependencies
- Direct: `sessions`
- Events instead of direct call: `discovery`, `notifications`, `analytics`

Exported providers
- `UserReaderService`
- `UserEligibilityService`
- `UserStateMutatorService`

Transaction boundary
- Account state mutations are transactional and audit-logged.

## Profiles Module

Purpose
- Public profile, profile photos, lifestyle, schedule, discovery prefs, communication prefs.

Controllers
- `ProfilesController`
- `ProfilePhotosController`
- `LifestyleController`
- `SchedulePreferencesController`
- `DiscoveryPreferencesController`
- `CommunicationPreferencesController`

Application services
- `GetMyProfileService`
- `UpdateProfileService`
- `InitiatePhotoUploadService`
- `FinalizePhotoUploadService`
- `ReorderProfilePhotosService`
- `SetPrimaryPhotoService`
- `DeleteProfilePhotoService`
- `UpdateLifestyleService`
- `UpdateSchedulePreferenceService`
- `UpdateDiscoveryPreferenceService`
- `UpdateCommunicationPreferenceService`

Domain services
- `ProfileCompletenessService`
- `ProfileVisibilityPolicyService`
- `PhotoEligibilityService`
- `LocationPrivacyService`

Repositories
- `UserProfileRepository`
- `ProfilePhotoRepository`
- `UserLifestyleRepository`
- `UserSchedulePreferenceRepository`
- `UserDiscoveryPreferenceRepository`
- `UserCommunicationPreferenceRepository`

Policies / guards
- `ProfileOwnershipPolicy`
- `PhotoOwnershipPolicy`

Events
- `profile.updated`
- `profile.completed`
- `photo.uploaded`
- `photo.deleted`
- `photo.primary-changed`
- `communication-preference.updated`

Workers
- none directly; produces `photo.moderation`

Public API surface
- `GET /profiles/me`
- `PATCH /profiles/me`
- `POST /profiles/photos/upload`
- `POST /profiles/photos/finalize`
- `PATCH /profiles/photos/order`
- `PATCH /profiles/photos/:photoId/primary`
- `DELETE /profiles/photos/:photoId`
- `PUT /profiles/me/lifestyle`
- `PUT /profiles/me/schedule-preference`
- `PUT /profiles/me/discovery-preference`
- `PUT /profiles/me/communication-preference`

Internal dependencies
- Direct: `users`, `interests`, `feature-flags`
- Events instead of direct call: `discovery`, `moderation`, `analytics`

Exported providers
- `ProfileReaderService`
- `ProfileCompletenessService`
- `CommunicationPreferenceReaderService`
- `ProfileVisibilityPolicyService`

Transaction boundary
- Profile update and completeness recomputation are in the same transaction.
- Photo finalization and pending-row creation are transactional.

## Interests Module

Purpose
- Interest taxonomy and per-user intents/interests.

Controllers
- `InterestCatalogController`
- `MyInterestsController`
- `MyIntentsController`

Application services
- `ListInterestTagsService`
- `UpdateUserInterestsService`
- `UpdateUserIntentsService`

Domain services
- `InterestValidationService`
- `IntentCompatibilityService`

Repositories
- `InterestTagRepository`
- `UserInterestRepository`
- `UserIntentRepository`

Policies / guards
- `InterestOwnershipPolicy`

Events
- `user.interests-updated`
- `user.intents-updated`

Workers
- none

Public API surface
- `GET /interests`
- `PUT /users/me/interests`
- `PUT /users/me/intents`

Internal dependencies
- Direct: `users`
- Events instead of direct call: `profiles`, `discovery`, `analytics`

Exported providers
- `InterestCatalogService`
- `IntentCompatibilityService`
- `UserIntentReaderService`

Transaction boundary
- Interest and intent replacements are transactional set-rewrite operations.

## Discovery Module

Purpose
- Build the discovery feed from source-of-truth modules, rank it, and paginate it.

Controllers
- `DiscoveryController`

Application services
- `GetDiscoveryFeedService`
- `InvalidateDiscoverySnapshotService`

Domain services
- `CandidateEligibilityService`
- `DiscoveryRankingService`
- `DiscoveryDiversityService`
- `DiscoveryPayloadMapperService`

Repositories
- `DiscoveryQueryRepository`
- `DiscoverySnapshotRepository` (Redis)

Policies / guards
- `DiscoveryAccessPolicy`

Events
- `discovery.snapshot-invalidated`

Workers
- none

Public API surface
- `GET /discovery/feed`

Internal dependencies
- Direct: `users`, `profiles`, `interests`, `likes`, `matches`, `blocks`, `moderation`, `feature-flags`
- Events instead of direct call: listens to `profile.*`, `photo.moderation.completed`, `like.*`, `pass.*`, `match.*`, `block.*`, `trustscore.recomputed`

Exported providers
- `DiscoveryQueryService`

Transaction boundary
- Read-only request; no multi-table writes.

## Likes Module

Purpose
- Like, retract like, pass, and clear pass operations.

Controllers
- `LikesController`
- `PassesController`

Application services
- `CreateLikeService`
- `RetractLikeService`
- `CreatePassService`
- `ClearPassService`

Domain services
- `LikePolicyService`
- `PassPolicyService`

Repositories
- `LikeRepository`
- `PassRepository`

Policies / guards
- `LikePermissionPolicy`
- `PassPermissionPolicy`

Events
- `like.created`
- `like.retracted`
- `pass.created`
- `pass.cleared`

Workers
- `PassesCleanupWorker`

Public API surface
- `POST /likes`
- `DELETE /likes/:targetUserId`
- `POST /passes`
- `DELETE /passes/:targetUserId`

Internal dependencies
- Direct: `users`, `profiles`, `blocks`, `matches`, `conversations`
- Events instead of direct call: `notifications`, `discovery`, `analytics`

Exported providers
- `LikeReaderService`

Transaction boundary
- `CreateLikeService` owns the like->match atomic transaction across `Like`, `Match`, `Conversation`, and `MatchCommunicationSetting`.

## Matches Module

Purpose
- Match lifecycle and per-match communication settings.

Controllers
- `MatchesController`
- `MatchCommunicationSettingsController`

Application services
- `ListMatchesService`
- `GetMatchService`
- `EndMatchService`
- `UpdateMatchCommunicationSettingService`
- `CreateMatchArtifactsService` (internal)

Domain services
- `MatchPolicyService`
- `MatchCommunicationPolicyService`

Repositories
- `MatchRepository`
- `MatchCommunicationSettingRepository`

Policies / guards
- `MatchParticipantPolicy`

Events
- `match.created`
- `match.ended`
- `match.communication-setting.updated`

Workers
- none

Public API surface
- `GET /matches`
- `GET /matches/:matchId`
- `DELETE /matches/:matchId`
- `PUT /matches/:matchId/communication-settings/me`

Internal dependencies
- Direct: `users`, `profiles`
- Events instead of direct call: `conversations`, `messages`, `calls`, `notifications`, `analytics`

Exported providers
- `MatchReaderService`
- `MatchPolicyService`
- `MatchCommunicationPolicyService`

Transaction boundary
- Match ending is transactional and closes dependent conversation state through direct module orchestration when required.

## Conversations Module

Purpose
- Conversation list/detail and read-state management.

Controllers
- `ConversationsController`
- `ConversationReadsController`

Application services
- `ListConversationsService`
- `GetConversationService`
- `MarkConversationReadService`
- `CloseConversationService` (internal)

Domain services
- `ConversationAccessPolicyService`
- `UnreadCounterService`

Repositories
- `ConversationRepository`
- `ConversationReadRepository`

Policies / guards
- `ConversationParticipantPolicy`

Events
- `conversation.read-updated`
- `conversation.closed`

Workers
- none

Public API surface
- `GET /conversations`
- `GET /conversations/:conversationId`
- `GET /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/read`

Internal dependencies
- Direct: `matches`, `blocks`
- Events instead of direct call: `messages`, `notifications`, `analytics`

Exported providers
- `ConversationReaderService`
- `ConversationAccessPolicyService`
- `ConversationCloserService`

Transaction boundary
- Mark-read updates `ConversationRead` atomically.
- Close operations update conversation status in the same transaction as the triggering safety/match action when needed.

## Messages Module

Purpose
- Message send/edit/delete/finalize attachment and realtime typing orchestration.

Controllers
- `MessagesController`

Application services
- `SendMessageService`
- `EditMessageService`
- `DeleteMessageService`
- `FinalizeAttachmentMessageService`
- `EmitTypingIndicatorService`

Domain services
- `MessagePolicyService`
- `MessageSequenceService`
- `AttachmentPolicyService`

Repositories
- `MessageRepository`

Policies / guards
- `MessageSenderPolicy`
- `ConversationMessagePolicy`

Events
- `message.sent`
- `message.edited`
- `message.deleted`
- `message.typing`

Workers
- none in v1

Public API surface
- `POST /messages/attachments/upload`
- `POST /conversations/:conversationId/messages`
- `PATCH /messages/:messageId`
- `DELETE /messages/:messageId`
- `POST /messages/attachments/finalize`

Internal dependencies
- Direct: `conversations`, `matches`, `blocks`, `profiles`
- Events instead of direct call: `notifications`, `analytics`, `moderation`

Exported providers
- `MessageReaderService`
- `MessageDispatchService`

Transaction boundary
- Message create increments conversation sequence and writes the message in one transaction.

## Calls Module

Purpose
- Durable call session lifecycle and WebRTC signaling orchestration.

Controllers
- `CallsController`

Application services
- `InitiateCallService`
- `AcceptCallService`
- `DeclineCallService`
- `EndCallService`
- `RelaySignalService`

Domain services
- `CallPermissionService`
- `CallStateMachineService`

Repositories
- `CallSessionRepository`
- `SignalingStateRepository` (Redis)

Policies / guards
- `CallParticipantPolicy`

Events
- `call.initiated`
- `call.accepted`
- `call.connected`
- `call.ended`
- `call.missed`

Workers
- `CallCleanupStaleWorker`

Public API surface
- `POST /calls`
- `POST /calls/:callId/accept`
- `POST /calls/:callId/decline`
- `POST /calls/:callId/end`
- WebSocket namespace for `call.offer`, `call.answer`, `call.ice`, `call.ring-ack`

Internal dependencies
- Direct: `matches`, `conversations`, `blocks`, `profiles`, `presence`, `sessions`
- Events instead of direct call: `notifications`, `analytics`

Exported providers
- `CallPermissionService`
- `CallSessionReaderService`

Transaction boundary
- Call initiation and accept transitions are transactional.
- Offer/answer/ICE relay uses durable call-state checks plus Redis ephemeral writes.

## Presence Module

Purpose
- Online presence, socket registration, and session/socket lookup for fanout.

Controllers
- none

Application services
- `RegisterSocketService`
- `UnregisterSocketService`
- `HeartbeatPresenceService`
- `GetPresenceService`

Domain services
- `PresencePolicyService`

Repositories
- `PresenceRepository` (Redis)
- `SocketRegistryRepository` (Redis)

Policies / guards
- `WsSessionPolicy`

Events
- `presence.updated`

Workers
- none

Public API surface
- WebSocket connect/disconnect and heartbeat handlers

Internal dependencies
- Direct: `sessions`, `users`
- Events instead of direct call: `notifications`, `calls`

Exported providers
- `PresenceReaderService`
- `SocketRegistryService`

Transaction boundary
- none; Redis-only ephemeral updates.

## Notifications Module

Purpose
- Durable notification records and push dispatch.

Controllers
- `NotificationsController`

Application services
- `ListNotificationsService`
- `MarkNotificationReadService`
- `CreateNotificationService` (internal)

Domain services
- `NotificationPreferenceService`
- `NotificationDedupService`

Repositories
- `NotificationRepository`

Policies / guards
- `NotificationOwnershipPolicy`

Events
- `notification.created`
- `notification.read`

Workers
- `NotificationDispatchWorker`

Public API surface
- `GET /notifications`
- `POST /notifications/:notificationId/read`

Internal dependencies
- Direct: `profiles`, `sessions`, `feature-flags`
- Events instead of direct call: receives `match.created`, `message.sent`, `call.missed`, `moderation.action.applied`

Exported providers
- `NotificationWriterService`

Transaction boundary
- Inbox record creation is transactional with caller’s primary use case when user-visible durability matters.

## Reports Module

Purpose
- Report creation, deduplication, and reporter-facing queries.

Controllers
- `ReportsController`

Application services
- `CreateReportService`
- `ListMyReportsService`

Domain services
- `ReportPolicyService`
- `ReportDeduplicationService`

Repositories
- `ReportRepository`

Policies / guards
- `ReportOwnershipPolicy`

Events
- `report.created`

Workers
- none

Public API surface
- `POST /reports`
- `GET /reports/me`

Internal dependencies
- Direct: `users`, `matches`, `conversations`, `messages`, `calls`, `profiles`
- Events instead of direct call: `moderation`, `analytics`

Exported providers
- `ReportReaderService`

Transaction boundary
- Create-report transaction inserts/returns deduped report and can open/link moderation case metadata.

## Blocks Module

Purpose
- Hard safety barrier and its cascading effects.

Controllers
- `BlocksController`

Application services
- `CreateBlockService`
- `RemoveBlockService`
- `ListBlocksService`

Domain services
- `BlockPolicyService`

Repositories
- `BlockRepository`

Policies / guards
- `BlockOwnershipPolicy`

Events
- `block.created`
- `block.removed`

Workers
- none

Public API surface
- `POST /blocks`
- `DELETE /blocks/:blockedUserId`
- `GET /blocks`

Internal dependencies
- Direct: `users`, `matches`, `conversations`, `calls`
- Events instead of direct call: `discovery`, `notifications`, `analytics`

Exported providers
- `BlockReaderService`
- `BlockPolicyService`

Transaction boundary
- Create-block transaction upserts block, ends match, closes conversation, and ends active calls together.

## Moderation Module

Purpose
- Case management, trust scoring, photo review, and enforcement action application.

Controllers
- `ModerationInternalController`

Application services
- `CreateModerationCaseService`
- `AssignModerationCaseService`
- `ApplyModerationActionService`
- `ReviewProfilePhotoService`
- `RecomputeTrustScoreService`

Domain services
- `ModerationDecisionService`
- `TrustScoreDomainService`
- `SafetyActionPolicyService`

Repositories
- `ModerationCaseRepository`
- `TrustScoreRepository`
- `ModerationPhotoReadRepository`

Policies / guards
- `ModeratorActionPolicy`

Events
- `moderation.case.created`
- `moderation.case.updated`
- `moderation.action.applied`
- `photo.moderation.completed`
- `trustscore.recomputed`

Workers
- `PhotoModerationWorker`
- `TrustScoreRecomputeWorker`

Public API surface
- internal services and admin-only moderation endpoints

Internal dependencies
- Direct: `users`, `profiles`, `reports`, `matches`, `conversations`, `messages`, `calls`, `blocks`, `notifications`
- Events instead of direct call: `analytics`

Exported providers
- `ModerationActionService`
- `TrustScoreReaderService`
- `TrustScoreRecomputeService`

Transaction boundary
- Applying moderation actions updates target entities and writes audit entries in one transaction.

## Admin Module

Purpose
- Privileged operational interface for moderation, feature flags, and audit-backed admin actions.

Controllers
- `AdminUsersController`
- `AdminModerationController`
- `AdminFeatureFlagsController`
- `AdminAnalyticsController`
- `AdminAuditController`

Application services
- `AdminUserActionService`
- `AdminCaseDashboardService`
- `AdminFeatureFlagService`
- `AdminAnalyticsReadService`
- `AdminAuditReadService`

Domain services
- `AdminPermissionPolicyService`

Repositories
- `AdminDashboardQueryRepository`
- `AuditLogReadRepository`

Policies / guards
- `AdminRoleGuard`
- `AdminPermissionPolicy`

Events
- `admin.action.executed`

Workers
- none

Public API surface
- admin-only endpoints under `/admin/*`

Internal dependencies
- Direct: `users`, `moderation`, `feature-flags`, `analytics`, `notifications`
- Events instead of direct call: none for privileged action requests; admin actions are synchronous and audited

Exported providers
- none

Transaction boundary
- Admin actions wrap target writes and audit logging in one transaction.

## Analytics Module

Purpose
- Event ingestion and rollups.

Controllers
- `AnalyticsIngestController`

Application services
- `IngestAnalyticsEventService`
- `RollupAnalyticsWindowService`

Domain services
- `AnalyticsPolicyService`

Repositories
- `AnalyticsEventRepository`

Policies / guards
- `AnalyticsIngestPolicy`

Events
- `analytics.event.ingested`
- `analytics.rollup.completed`

Workers
- `AnalyticsRollupWorker`

Public API surface
- `POST /analytics/events`

Internal dependencies
- Direct: `users`, `sessions`
- Events instead of direct call: receives domain events from all business modules for server-side analytics

Exported providers
- `AnalyticsWriterService`

Transaction boundary
- Event ingest is append-only and transactionally isolated from business writes.

## Feature-Flags Module

Purpose
- Evaluate and mutate feature flags.

Controllers
- `FeatureFlagsController`

Application services
- `EvaluateFeatureFlagService`
- `UpsertFeatureFlagService`
- `ListFeatureFlagsService`

Domain services
- `FeatureFlagRuleService`

Repositories
- `FeatureFlagRepository`

Policies / guards
- `FeatureFlagAdminPolicy`

Events
- `feature-flag.updated`

Workers
- none

Public API surface
- admin/internal feature-flag endpoints

Internal dependencies
- Direct: `users`
- Events instead of direct call: `audit`, `analytics`

Exported providers
- `FeatureFlagEvaluatorService`

Transaction boundary
- Upsert/delete of a flag is transactional and audit-logged.

## Direct-Call vs Event Rules

Direct synchronous calls are allowed for:
- auth -> users, sessions
- likes -> blocks, matches, conversations
- blocks -> matches, conversations, calls
- messages -> conversations, matches, blocks
- calls -> matches, conversations, blocks, presence
- moderation/admin -> target modules when applying durable actions

Event-based communication is mandatory for:
- notifications
- analytics
- discovery cache invalidation
- photo moderation follow-up
- trust recomputation
- websocket fanout after commit
