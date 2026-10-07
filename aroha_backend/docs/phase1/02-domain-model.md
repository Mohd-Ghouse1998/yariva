# 2. COMPLETE DOMAIN MODEL

All IDs are UUIDs. All timestamps are UTC `timestamptz`. `createdAt` and `updatedAt` exist unless explicitly append-only. PostgreSQL is the source of truth. Redis-only state is intentionally excluded from this domain model.

## User

Purpose: canonical account identity, auth-adjacent account state, and moderation gates.

Fields
- `id`: uuid, required, primary key
- `email`: varchar(320), optional, unique when present
- `phone`: varchar(32), optional, unique when present
- `passwordHash`: varchar(255), required
- `role`: enum `UserRole`, required, default `USER`
- `status`: enum `UserStatus`, required, default `ACTIVE`
- `isShadowBanned`: boolean, required, default `false`
- `isDiscoveryFrozen`: boolean, required, default `false`
- `isChatFrozen`: boolean, required, default `false`
- `isCallFrozen`: boolean, required, default `false`
- `lastActiveAt`: timestamptz, optional
- `suspendedAt`: timestamptz, optional
- `bannedAt`: timestamptz, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `email`, `phone`

Indexes
- `status, deletedAt`
- `lastActiveAt`

Foreign keys
- none

Soft delete behavior
- `deletedAt` marks account deletion; row is retained for referential integrity and auditability.

Lifecycle rules
- Created during signup.
- `status` transitions through moderation/admin actions.
- Suspended/banned users are removed from discovery and interaction surfaces.

Ownership rules
- Owned by `users` module.
- `auth`, `sessions`, `moderation`, `admin`, and `discovery` may read it.

## UserSession

Purpose: durable session/device record and refresh-token rotation state.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required
- `deviceId`: varchar(128), optional
- `deviceName`: varchar(128), optional
- `platform`: enum `ClientPlatform`, required, default `UNKNOWN`
- `appVersion`: varchar(64), optional
- `ipAddress`: varchar(64), optional
- `userAgent`: varchar(500), optional
- `currentRefreshTokenHash`: varchar(128), required
- `currentRefreshTokenJti`: varchar(64), required, unique
- `previousRefreshTokenHash`: varchar(128), optional
- `previousRefreshTokenJti`: varchar(64), optional
- `previousRefreshTokenGraceUntil`: timestamptz, optional
- `refreshTokenExpiresAt`: timestamptz, required
- `lastSeenAt`: timestamptz, optional
- `revokedAt`: timestamptz, optional
- `revokedReason`: varchar(128), optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `currentRefreshTokenJti`

Indexes
- `userId, revokedAt`
- `refreshTokenExpiresAt`
- `lastSeenAt`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- `deletedAt` only for retention cleanup after revocation/expiry.

Lifecycle rules
- Created on login/signup.
- Refresh rotates current/previous token hashes atomically.
- Replay outside grace window revokes the session.

Ownership rules
- Owned by `sessions` module.

## PushToken

Purpose: push delivery endpoint bound to a user/session/device.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required
- `sessionId`: uuid, optional
- `token`: varchar(512), required, unique
- `platform`: enum `ClientPlatform`, required
- `provider`: enum `PushProvider`, required
- `deviceId`: varchar(128), optional
- `lastSeenAt`: timestamptz, optional
- `invalidatedAt`: timestamptz, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `token`

Indexes
- `userId, invalidatedAt`
- `sessionId`

Foreign keys
- `userId -> User.id`
- `sessionId -> UserSession.id`

Soft delete behavior
- invalidation uses `invalidatedAt`; retention cleanup may set `deletedAt`.

Lifecycle rules
- Upserted on device registration.
- Invalidated when provider rejects token or session/user is revoked.

Ownership rules
- Owned by `sessions` module.

## UserProfile

Purpose: public profile content and privacy-safe location basis.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required, unique
- `displayName`: varchar(80), optional until profile completion
- `headline`: varchar(140), optional
- `bio`: text, optional
- `dateOfBirth`: timestamptz, optional until completion
- `gender`: enum `ProfileGender`, optional
- `pronouns`: varchar(80), optional
- `city`: varchar(120), optional
- `region`: varchar(120), optional
- `countryCode`: char(2), optional
- `locationLat`: decimal(9,6), optional
- `locationLng`: decimal(9,6), optional
- `locationGeohash`: varchar(12), optional
- `locationUpdatedAt`: timestamptz, optional
- `hideAge`: boolean, required, default `false`
- `hideDistance`: boolean, required, default `false`
- `isHidden`: boolean, required, default `false`
- `isComplete`: boolean, required, default `false`
- `completedAt`: timestamptz, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId`

Indexes
- `isComplete, isHidden, deletedAt`
- `countryCode, city`
- `locationGeohash`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- `deletedAt` hides profile without deleting user row.

Lifecycle rules
- Created with user account.
- `isComplete` flips true only when mandatory discovery requirements are satisfied.

Ownership rules
- Owned by `profiles` module.

## ProfilePhoto

Purpose: user-owned photo metadata, ordering, and moderation state.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required
- `objectKey`: varchar(512), required
- `bucket`: varchar(128), required
- `mimeType`: varchar(128), required
- `sizeBytes`: int, required
- `width`: int, optional
- `height`: int, optional
- `sha256`: varchar(128), optional
- `position`: int, required, default `0`
- `isPrimary`: boolean, required, default `false`
- `moderationStatus`: enum `PhotoModerationStatus`, required, default `PENDING`
- `moderationReason`: varchar(500), optional
- `reviewedAt`: timestamptz, optional
- `approvedAt`: timestamptz, optional
- `rejectedAt`: timestamptz, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`

Indexes
- `userId, moderationStatus, deletedAt`
- `userId, isPrimary, deletedAt`
- `userId, position`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- `deletedAt` hides the photo permanently from public/profile payloads.

Lifecycle rules
- Starts `PENDING`.
- Only `APPROVED` and not soft-deleted photos are publicly visible.
- Pending/rejected photos never count as active discovery photos.

Ownership rules
- Owned by `profiles` module; reviewed by `moderation`.

## UserIntent

Purpose: selected connection intents per user.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required
- `intent`: enum `ConnectionIntent`, required
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId, intent`

Indexes
- `intent, deletedAt`
- `userId, deletedAt`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- Deselection sets `deletedAt`; the row can later be reactivated.

Lifecycle rules
- Must contain at least one active intent for discoverability.

Ownership rules
- Owned by `interests` module.

## InterestTag

Purpose: canonical interest taxonomy.

Fields
- `id`: uuid, required, primary key
- `slug`: varchar(80), required, unique
- `displayName`: varchar(120), required, unique
- `category`: varchar(80), optional
- `isActive`: boolean, required, default `true`
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `slug`, `displayName`

Indexes
- `category, isActive`

Foreign keys
- none

Soft delete behavior
- no soft delete; inactive tags remain referentially valid.

Lifecycle rules
- Managed by admin/backoffice.

Ownership rules
- Owned by `interests` module.

## UserInterest

Purpose: join table from user to selected interests.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required
- `interestTagId`: uuid, required
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId, interestTagId`

Indexes
- `interestTagId, deletedAt`
- `userId, deletedAt`

Foreign keys
- `userId -> User.id`
- `interestTagId -> InterestTag.id`

Soft delete behavior
- Deselection sets `deletedAt`; the same row can be reactivated later.

Lifecycle rules
- A profile may be complete without interests, but scoring improves with active interests.

Ownership rules
- Owned by `interests` module.

## UserLifestyle

Purpose: single-row lifestyle compatibility data.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required, unique
- `smoking`: enum `SmokingHabit`, optional
- `drinking`: enum `DrinkingHabit`, optional
- `exercise`: enum `ExerciseHabit`, optional
- `diet`: enum `DietPreference`, optional
- `petPreference`: enum `PetPreference`, optional
- `sleepPattern`: enum `SleepPattern`, optional
- `socialEnergy`: enum `SocialEnergyLevel`, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId`

Indexes
- `userId`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- none; row is updated in place.

Lifecycle rules
- Optional but used in discovery ranking.

Ownership rules
- Owned by `profiles` module.

## UserSchedulePreference

Purpose: single-row structured availability for ranking and matching.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required, unique
- `weekdayMask`: int, required, default `0`
- `timeBlockMask`: int, required, default `0`
- `prefersWeekends`: boolean, required, default `false`
- `remoteFriendly`: boolean, required, default `false`
- `maxMeetupsPerWeek`: int, optional
- `preferredLeadTimeDays`: int, optional
- `timezone`: varchar(64), optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId`

Indexes
- `userId`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- none; row is updated in place.

Lifecycle rules
- Optional but contributes to schedule overlap scoring.

Ownership rules
- Owned by `profiles` module.

## UserDiscoveryPreference

Purpose: single-row discovery filter preferences.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required, unique
- `minAge`: int, optional
- `maxAge`: int, optional
- `maxDistanceKm`: int, optional
- `intentFilter`: enum array `ConnectionIntent[]`, required, default empty array
- `preferredGenders`: enum array `ProfileGender[]`, required, default empty array
- `includeRecentlyActiveOnly`: boolean, required, default `false`
- `preferSameCity`: boolean, required, default `false`
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId`

Indexes
- `userId`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- none; row is updated in place.

Lifecycle rules
- Used by discovery query builder and preference hash invalidation.

Ownership rules
- Owned by `profiles` module and read by `discovery`.

## UserCommunicationPreference

Purpose: global user communication permissions and notification settings.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required, unique
- `allowVoiceCalls`: boolean, required, default `true`
- `allowVideoCalls`: boolean, required, default `true`
- `allowPushMatches`: boolean, required, default `true`
- `allowPushMessages`: boolean, required, default `true`
- `allowPushCalls`: boolean, required, default `true`
- `allowReadReceipts`: boolean, required, default `true`
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId`

Indexes
- `userId`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- none; row is updated in place.

Lifecycle rules
- Global preferences are checked before per-match settings for calls.

Ownership rules
- Owned by `profiles` module; read by `calls`, `notifications`, and `messages`.

## Like

Purpose: directional interest signal from actor to target.

Fields
- `id`: uuid, required, primary key
- `actorId`: uuid, required
- `targetId`: uuid, required
- `status`: enum `LikeStatus`, required, default `ACTIVE`
- `matchedAt`: timestamptz, optional
- `retractedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `actorId, targetId`

Indexes
- `actorId, status`
- `targetId, status`

Foreign keys
- `actorId -> User.id`
- `targetId -> User.id`

Soft delete behavior
- none; row is updated in place to preserve unique pair history.

Lifecycle rules
- Self-like forbidden.
- One row per actor-target pair for lifetime.
- `RETRACTED` can be reactivated.
- `MATCHED` indicates the pair contributed to a durable match.

Ownership rules
- Owned by `likes` module.

## Pass

Purpose: directional skip signal with reappearance TTL.

Fields
- `id`: uuid, required, primary key
- `actorId`: uuid, required
- `targetId`: uuid, required
- `expiresAt`: timestamptz, required
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `actorId, targetId`

Indexes
- `actorId, expiresAt, deletedAt`
- `targetId, expiresAt, deletedAt`

Foreign keys
- `actorId -> User.id`
- `targetId -> User.id`

Soft delete behavior
- Clearing a pass uses `deletedAt`; otherwise expiry alone removes eligibility effect.

Lifecycle rules
- Re-passing updates the existing row and pushes `expiresAt`.

Ownership rules
- Owned by `likes` module and read by `discovery`.

## Match

Purpose: canonical durable mutual-like relationship between exactly two users.

Fields
- `id`: uuid, required, primary key
- `userLowId`: uuid, required
- `userHighId`: uuid, required
- `status`: enum `MatchStatus`, required, default `ACTIVE`
- `matchedAt`: timestamptz, required
- `endedAt`: timestamptz, optional
- `endedReason`: enum `MatchEndReason`, optional
- `endedByUserId`: uuid, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userLowId, userHighId`

Indexes
- `userLowId, status`
- `userHighId, status`
- `status, matchedAt`

Foreign keys
- `userLowId -> User.id`
- `userHighId -> User.id`

Soft delete behavior
- none; terminal state uses `status` + `endedAt`.

Lifecycle rules
- Canonical ordering is `min(userA, userB)` into `userLowId`.
- Exactly one active or historical match pair row exists.
- Block ends the match with reason `BLOCKED`.

Ownership rules
- Owned by `matches` module.

## MatchCommunicationSetting

Purpose: one per user per match for consent-first per-match communication controls.

Fields
- `id`: uuid, required, primary key
- `matchId`: uuid, required
- `userId`: uuid, required
- `allowVoiceCalls`: boolean, required, default `true`
- `allowVideoCalls`: boolean, required, default `true`
- `muted`: boolean, required, default `false`
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `matchId, userId`

Indexes
- `userId`
- `matchId`

Foreign keys
- `matchId -> Match.id`
- `userId -> User.id`

Soft delete behavior
- none; the row survives match closure for audit/history.

Lifecycle rules
- Created transactionally with match creation.

Ownership rules
- Owned by `matches` module.

## Conversation

Purpose: single chat thread projection for a match.

Fields
- `id`: uuid, required, primary key
- `matchId`: uuid, required, unique
- `status`: enum `ConversationStatus`, required, default `ACTIVE`
- `lastMessageSequence`: int, required, default `0`
- `lastMessagePreview`: varchar(160), optional
- `lastMessageType`: enum `MessageType`, optional
- `lastMessageSentAt`: timestamptz, optional
- `lastSenderId`: uuid, optional
- `closedAt`: timestamptz, optional
- `closedReason`: enum `ConversationCloseReason`, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `matchId`

Indexes
- `status, lastMessageSentAt`
- `matchId`

Foreign keys
- `matchId -> Match.id`

Soft delete behavior
- none; closure uses status fields.

Lifecycle rules
- Created only with match creation.
- After block/unmatch it becomes closed for activity, but history remains.

Ownership rules
- Owned by `conversations` module.

## Message

Purpose: durable ordered chat message or tombstone entry.

Fields
- `id`: uuid, required, primary key
- `conversationId`: uuid, required
- `senderId`: uuid, required
- `sequence`: int, required
- `clientMessageId`: varchar(64), optional
- `type`: enum `MessageType`, required, default `TEXT`
- `textBody`: text, optional
- `attachmentObjectKey`: varchar(512), optional
- `attachmentBucket`: varchar(128), optional
- `attachmentMimeType`: varchar(128), optional
- `attachmentSizeBytes`: int, optional
- `attachmentWidth`: int, optional
- `attachmentHeight`: int, optional
- `attachmentDurationSeconds`: int, optional
- `attachmentModerationStatus`: enum `ContentModerationStatus`, optional
- `status`: enum `MessageStatus`, required, default `ACTIVE`
- `replyToMessageId`: uuid, optional
- `editedAt`: timestamptz, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `conversationId, sequence`
- Unique: `conversationId, senderId, clientMessageId`

Indexes
- `conversationId, createdAt`
- `senderId, createdAt`
- `status, deletedAt`

Foreign keys
- `conversationId -> Conversation.id`
- `senderId -> User.id`
- `replyToMessageId -> Message.id`

Soft delete behavior
- `deletedAt` + status create a tombstone; row is retained for ordering and audit.

Lifecycle rules
- New messages require active match, active conversation, and no active block.
- Media messages may remain pending moderation before recipient visibility.

Ownership rules
- Owned by `messages` module.

## ConversationRead

Purpose: per-user per-conversation read progress and unread derivation anchor.

Fields
- `id`: uuid, required, primary key
- `conversationId`: uuid, required
- `userId`: uuid, required
- `lastReadMessageId`: uuid, optional
- `lastReadSequence`: int, required, default `0`
- `lastReadAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `conversationId, userId`

Indexes
- `userId, lastReadAt`
- `conversationId`

Foreign keys
- `conversationId -> Conversation.id`
- `userId -> User.id`

Soft delete behavior
- none; row is updated in place.

Lifecycle rules
- Created when conversation is created.
- `lastReadSequence` is monotonic increasing.

Ownership rules
- Owned by `conversations` module.

## CallSession

Purpose: durable metadata for a WebRTC signaling attempt across a match.

Fields
- `id`: uuid, required, primary key
- `matchId`: uuid, required
- `conversationId`: uuid, required
- `initiatorUserId`: uuid, required
- `receiverUserId`: uuid, required
- `callType`: enum `CallType`, required
- `status`: enum `CallSessionStatus`, required, default `RINGING`
- `signalingVersion`: int, required, default `1`
- `initiatorSessionId`: uuid, optional
- `acceptedBySessionId`: uuid, optional
- `ringStartedAt`: timestamptz, optional
- `acceptedAt`: timestamptz, optional
- `connectedAt`: timestamptz, optional
- `endedAt`: timestamptz, optional
- `expiresAt`: timestamptz, required
- `endedByUserId`: uuid, optional
- `endReason`: enum `CallEndReason`, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`

Indexes
- `matchId, status`
- `receiverUserId, status`
- `initiatorUserId, status`
- `expiresAt`

Foreign keys
- `matchId -> Match.id`
- `conversationId -> Conversation.id`
- `initiatorUserId -> User.id`
- `receiverUserId -> User.id`

Soft delete behavior
- none; terminal states are preserved.

Lifecycle rules
- Backend stores metadata only, not media transport data.
- Active permissions are rechecked on call state transitions.

Ownership rules
- Owned by `calls` module.

## Block

Purpose: directional hard safety barrier between two users.

Fields
- `id`: uuid, required, primary key
- `blockerId`: uuid, required
- `blockedId`: uuid, required
- `reason`: varchar(500), optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `blockerId, blockedId`

Indexes
- `blockerId, deletedAt`
- `blockedId, deletedAt`

Foreign keys
- `blockerId -> User.id`
- `blockedId -> User.id`

Soft delete behavior
- Unblock sets `deletedAt`; history is retained.

Lifecycle rules
- Active block immediately removes discovery, chat, and calling paths.

Ownership rules
- Owned by `blocks` module.

## Report

Purpose: immutable abuse/safety report record.

Fields
- `id`: uuid, required, primary key
- `reporterUserId`: uuid, required
- `reportedUserId`: uuid, required
- `targetType`: enum `ReportTargetType`, required
- `reasonCode`: enum `ReportReasonCode`, required
- `description`: varchar(2000), optional
- `targetMatchId`: uuid, optional
- `targetConversationId`: uuid, optional
- `targetMessageId`: uuid, optional
- `targetPhotoId`: uuid, optional
- `targetCallSessionId`: uuid, optional
- `status`: enum `ReportStatus`, required, default `OPEN`
- `dedupeKey`: varchar(255), required, unique
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required
- `closedAt`: timestamptz, optional

Constraints
- PK: `id`
- Unique: `dedupeKey`

Indexes
- `reportedUserId, status, createdAt`
- `reporterUserId, createdAt`
- `targetMessageId`
- `targetPhotoId`

Foreign keys
- `reporterUserId -> User.id`
- `reportedUserId -> User.id`
- `targetMatchId -> Match.id`
- `targetConversationId -> Conversation.id`
- `targetMessageId -> Message.id`
- `targetPhotoId -> ProfilePhoto.id`
- `targetCallSessionId -> CallSession.id`

Soft delete behavior
- none; reports are immutable records.

Lifecycle rules
- Duplicate open reports are deduped by `dedupeKey`.

Ownership rules
- Owned by `reports` module and read by `moderation`.

## ModerationCase

Purpose: operational case record for review and enforcement actions.

Fields
- `id`: uuid, required, primary key
- `subjectUserId`: uuid, required
- `sourceReportId`: uuid, optional
- `caseType`: enum `ModerationCaseType`, required
- `priority`: enum `ModerationPriority`, required, default `MEDIUM`
- `status`: enum `ModerationCaseStatus`, required, default `OPEN`
- `assignedAdminUserId`: uuid, optional
- `summary`: varchar(500), optional
- `findings`: jsonb, optional
- `actionTaken`: enum `ModerationAction`, required, default `NONE`
- `actionNotes`: varchar(2000), optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required
- `closedAt`: timestamptz, optional

Constraints
- PK: `id`

Indexes
- `subjectUserId, status`
- `priority, status`
- `assignedAdminUserId, status`

Foreign keys
- `subjectUserId -> User.id`
- `sourceReportId -> Report.id`
- `assignedAdminUserId -> User.id`

Soft delete behavior
- none; cases are retained permanently.

Lifecycle rules
- Case can aggregate multiple reports operationally even if only one `sourceReportId` is stored as origin.

Ownership rules
- Owned by `moderation` module.

## TrustScore

Purpose: current trust/risk evaluation per user.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required, unique
- `score`: int, required, default `70`
- `level`: enum `TrustLevel`, required, default `HIGH`
- `factors`: jsonb, optional
- `lastComputedAt`: timestamptz, required
- `manualOverrideScore`: int, optional
- `manualOverrideReason`: varchar(500), optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `userId`

Indexes
- `score`
- `level, lastComputedAt`

Foreign keys
- `userId -> User.id`

Soft delete behavior
- none; current row is updated in place.

Lifecycle rules
- Created at signup.
- Recomputed asynchronously on trust triggers.

Ownership rules
- Owned by `moderation` module; read by `discovery` and `admin`.

## Notification

Purpose: durable inbox/push notification record.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, required
- `actorUserId`: uuid, optional
- `type`: enum `NotificationType`, required
- `channel`: enum `NotificationChannel`, required, default `IN_APP`
- `title`: varchar(140), required
- `body`: varchar(500), required
- `data`: jsonb, optional
- `status`: enum `NotificationStatus`, required, default `PENDING`
- `dedupeKey`: varchar(255), optional, unique when present
- `readAt`: timestamptz, optional
- `sentAt`: timestamptz, optional
- `failedAt`: timestamptz, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `dedupeKey` when present

Indexes
- `userId, status, createdAt`
- `userId, readAt`

Foreign keys
- `userId -> User.id`
- `actorUserId -> User.id`

Soft delete behavior
- `deletedAt` supports inbox cleanup without losing delivery audit.

Lifecycle rules
- Created synchronously with durable product state if user-visible.
- Delivery is asynchronous through `notification.dispatch`.

Ownership rules
- Owned by `notifications` module.

## FeatureFlag

Purpose: operational feature rollout control.

Fields
- `id`: uuid, required, primary key
- `key`: varchar(120), required, unique
- `description`: varchar(500), optional
- `scope`: enum `FeatureFlagScope`, required, default `GLOBAL`
- `enabled`: boolean, required, default `false`
- `rolloutPercentage`: int, optional
- `variant`: varchar(50), optional
- `config`: jsonb, optional
- `allowlistUserIds`: jsonb, optional
- `createdByUserId`: uuid, optional
- `deletedAt`: timestamptz, optional
- `createdAt`: timestamptz, required
- `updatedAt`: timestamptz, required

Constraints
- PK: `id`
- Unique: `key`

Indexes
- `scope, enabled`

Foreign keys
- `createdByUserId -> User.id`

Soft delete behavior
- `deletedAt` retires the flag while preserving history.

Lifecycle rules
- Only admin can mutate.
- Evaluated read-only by application services.

Ownership rules
- Owned by `feature-flags` module.

## AnalyticsEvent

Purpose: append-only product instrumentation record.

Fields
- `id`: uuid, required, primary key
- `userId`: uuid, optional
- `sessionId`: uuid, optional
- `eventName`: varchar(120), required
- `source`: enum `AnalyticsSource`, required, default `MOBILE`
- `properties`: jsonb, optional
- `occurredAt`: timestamptz, required
- `receivedAt`: timestamptz, required

Constraints
- PK: `id`

Indexes
- `eventName, occurredAt`
- `userId, occurredAt`
- `sessionId, occurredAt`

Foreign keys
- `userId -> User.id`
- `sessionId -> UserSession.id`

Soft delete behavior
- none; append-only.

Lifecycle rules
- Recorded asynchronously where possible; never blocks core user transaction success.

Ownership rules
- Owned by `analytics` module.

## AuditLog

Purpose: append-only security and governance log.

Fields
- `id`: uuid, required, primary key
- `actorUserId`: uuid, optional
- `actorSessionId`: uuid, optional
- `action`: varchar(120), required
- `entityType`: varchar(80), required
- `entityId`: varchar(64), optional
- `targetUserId`: uuid, optional
- `ipAddress`: varchar(64), optional
- `userAgent`: varchar(500), optional
- `metadata`: jsonb, optional
- `createdAt`: timestamptz, required

Constraints
- PK: `id`

Indexes
- `actorUserId, createdAt`
- `entityType, entityId`
- `targetUserId, createdAt`

Foreign keys
- `actorUserId -> User.id`
- `actorSessionId -> UserSession.id`
- `targetUserId -> User.id`

Soft delete behavior
- none; append-only.

Lifecycle rules
- Written for auth/session/admin/moderation/safety actions.

Ownership rules
- Owned by common audit infrastructure and written by multiple modules through an append-only service.
