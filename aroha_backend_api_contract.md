# Aroha Backend API & WebSocket Contract

## API Configuration

- **Base Path**: `/api/v1`
- **Global Prefix**: `api/v1`
- **CORS**: Enabled (configured via `buildHttpCorsOptions()`)
- **Port**: 3000 (configurable via `PORT` env var)

---

## REST Endpoints by Module

### Auth Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `auth/signup` | `SignupDto` | `AuthResponseDto` | Public |
| POST | `auth/login` | `LoginDto` | `AuthResponseDto` | Public |
| POST | `auth/refresh` | `RefreshTokenDto` | `RefreshResponseDto` | Public |
| POST | `auth/logout` | (empty) | void (204 No Content) | Protected |

### Users Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `users/me` | N/A | `GetMeResponseDto` | Protected |

### Profiles Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `profiles/me` | N/A | `MyProfileResponseDto` | Protected |
| PATCH | `profiles/me` | `UpdateMyProfileDto` | `MyProfileResponseDto` | Protected |
| PUT | `profiles/me/lifestyle` | `UpdateLifestyleDto` | `PreferenceValueResponseDto<LifestyleDto>` | Protected |
| PUT | `profiles/me/schedule-preference` | `UpdateSchedulePreferenceDto` | `PreferenceValueResponseDto<SchedulePreferenceDto>` | Protected |
| PUT | `profiles/me/discovery-preference` | `UpdateDiscoveryPreferenceDto` | `PreferenceValueResponseDto<DiscoveryPreferenceDto>` | Protected |
| PUT | `profiles/me/communication-preference` | `UpdateCommunicationPreferenceDto` | `PreferenceValueResponseDto<CommunicationPreferenceDto>` | Protected |

### Profile Photos Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `profiles/photos/upload` | `InitiateProfilePhotoUploadDto` | `InitiateProfilePhotoUploadResponseDto` | Protected |
| POST | `profiles/photos/finalize` | `FinalizeProfilePhotoUploadDto` | `FinalizeProfilePhotoUploadResponseDto` | Protected |
| PATCH | `profiles/photos/order` | `ReorderProfilePhotosDto` | `ProfilePhotoListResponseDto` | Protected |
| PATCH | `profiles/photos/:photoId/primary` | (empty) | `ProfilePhotoResponseDto` | Protected |
| DELETE | `profiles/photos/:photoId` | N/A | void (204 No Content) | Protected |

### Interests Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `interests` | Query: `InterestCatalogQueryDto` | `InterestTagPageDto` | Public |
| PUT | `users/me/interests` | `UpdateMyInterestsDto` | `UpdateMyInterestsResponseDto` | Protected |
| PUT | `users/me/intents` | `UpdateMyIntentsDto` | `UpdateMyIntentsResponseDto` | Protected |

### Discovery Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `discovery/feed` | Query: `CursorPageQueryDto` | `DiscoveryFeedResponseDto` | Protected |

### Likes Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `likes` | `CreateLikeDto` | `CreateLikeResponseDto` | Protected |
| DELETE | `likes/:targetUserId` | N/A | void (204 No Content) | Protected |
| POST | `passes` | `CreatePassDto` | `PassDto` | Protected |
| DELETE | `passes/:targetUserId` | N/A | void (204 No Content) | Protected |

### Matches Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `matches` | Query: `CursorPageQueryDto` | `MatchPageDto` | Protected |
| GET | `matches/:matchId` | N/A | `MatchDetailResponseDto` | Protected |
| DELETE | `matches/:matchId` | N/A | `EndMatchResponseDto` | Protected |
| PUT | `matches/:matchId/communication-settings/me` | `UpdateMyMatchCommunicationSettingDto` | `UpdateMyMatchCommunicationSettingResponseDto` | Protected |

### Conversations Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `conversations` | Query: `CursorPageQueryDto` | `ConversationPageDto` | Protected |
| GET | `conversations/:conversationId` | N/A | `ConversationDetailResponseDto` | Protected |
| GET | `conversations/:conversationId/messages` | Query: `ConversationMessagePageQueryDto` | `MessagePageDto` | Protected |
| POST | `conversations/:conversationId/read` | `ConversationReadRequestDto` | `ConversationReadResponseDto` | Protected |

### Messages Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `messages/attachments/upload` | `InitiateMessageAttachmentUploadDto` | `InitiateMessageAttachmentUploadResponseDto` | Protected |
| POST | `conversations/:conversationId/messages` | `CreateConversationMessageDto` | `MessageResponseDto` | Protected |
| POST | `messages/attachments/finalize` | `FinalizeMessageAttachmentDto` | `MessageResponseDto` | Protected |
| PATCH | `messages/:messageId` | `UpdateMessageDto` | `MessageResponseDto` | Protected |
| DELETE | `messages/:messageId` | N/A | void (204 No Content) | Protected |

### Calls Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `calls` | `InitiateCallDto` | `InitiateCallResponseDto` | Protected |
| POST | `calls/:callId/accept` | `EmptyCallActionDto` | `AcceptCallResponseDto` | Protected |
| POST | `calls/:callId/decline` | `EmptyCallActionDto` | `CallResponseDto` | Protected |
| POST | `calls/:callId/end` | `EndCallDto` | `CallResponseDto` | Protected |

### Sessions Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `sessions` | Query: `CursorPageQueryDto` | `SessionPageDto` | Protected |
| DELETE | `sessions/others` | N/A | `RevokeOtherSessionsResponseDto` | Protected |
| DELETE | `sessions/:sessionId` | N/A | void (204 No Content) | Protected |

### Push Tokens Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `push-tokens` | `PushTokenDto` | `PushTokenResponseDto` | Protected |
| DELETE | `push-tokens/:tokenId` | N/A | void (204 No Content) | Protected |

### Notifications Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| GET | `notifications` | Query: `CursorPageQueryDto` | `NotificationPageDto` | Protected |
| POST | `notifications/:notificationId/read` | (empty) | `NotificationResponseDto` | Protected |

### Blocks Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `blocks` | `CreateBlockDto` | `BlockResponseDto` | Protected |
| DELETE | `blocks/:blockedUserId` | N/A | void (204 No Content) | Protected |
| GET | `blocks` | Query: `CursorPageQueryDto` | `BlockPageDto` | Protected |

### Reports Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `reports` | `CreateReportDto` | `CreateReportResponseDto` | Protected |
| GET | `reports/me` | Query: `CursorPageQueryDto` | `ReportPageDto` | Protected |

### Analytics Module

| Method | Path | Request Body | Response Type | Auth |
|--------|------|--------------|---------------|------|
| POST | `analytics/events` | `IngestAnalyticsEventsDto` | `IngestAnalyticsEventsResponseDto` (202 Accepted) | Protected |

---

## WebSocket Gateways

### Namespace: `/ws`

#### Handshake Auth

```typescript
interface WsHandshakeAuthDto {
  accessToken: string;      // JWT access token
  sessionId: string;        // UUID of session
  lastEventId?: string | null; // Optional event ID for backlog (Phase 1: not implemented)
}
```

#### Presence Gateway (`PresenceGateway`)

**Connection Lifecycle:**
1. Client connects with auth in handshake
2. Server emits `system.ready` with `WsReadyDto`
3. Client maintains heartbeat; on disconnect server unregisters

**Client → Server Events:**

| Event Name | Payload Type | Ack Response | Notes |
|------------|--------------|--------------|-------|
| `presence.heartbeat` | `PresenceHeartbeatDto` | `requestId` (string) | Keep-alive with status="ONLINE" |
| `conversation.typing.start` | `ConversationTypingEventDto` | `requestId` (string) | Emit typing indicator start |
| `conversation.typing.stop` | `ConversationTypingEventDto` | `requestId` (string) | Emit typing indicator stop |

**Server → Client Events:**

| Event Name | Payload Type | Direction | Notes |
|------------|--------------|-----------|-------|
| `system.ready` | `WsReadyDto` | Server→Client | Sent immediately after auth handshake |
| `system.error` | `WsSystemErrorDto` | Server→Client | Sent on handshake/connection errors or unacked events |
| `presence.updated` | `PresenceUpdatedEventDto` | Server→Client | Presence update for other users |
| `conversation.typing.updated` | `ConversationTypingUpdatedEventDto` | Server→Client | Typing indicator update |

#### Calls Gateway (`CallsGateway`)

**Client → Server Events:**

| Event Name | Payload Type | Ack Response | Notes |
|------------|--------------|--------------|-------|
| `call.ring.ack` | `CallRingAckWsDto` | `requestId` (string) | ACK ringing event from server |
| `call.offer` | `CallOfferWsDto` | `requestId` (string) | WebRTC offer SDP |
| `call.answer` | `CallAnswerWsDto` | `requestId` (string) | WebRTC answer SDP |
| `call.ice` | `CallIceWsDto` | `requestId` (string) | ICE candidate |

**Server → Client Events:**

| Event Name | Payload Type | Direction | Notes |
|------------|--------------|-----------|-------|
| `system.error` | `WsSystemErrorDto` | Server→Client | Sent on validation/processing errors |
| (Call signaling events) | (Relayed from other participant) | Server→Client | Offers, answers, ICE candidates relayed between peers |

---

## All Enums (from Prisma Schema)

### UserRole
- `USER`
- `MODERATOR`
- `ADMIN`

### UserStatus
- `ACTIVE`
- `RESTRICTED`
- `SUSPENDED`
- `BANNED`
- `DELETED`

### ClientPlatform
- `IOS`
- `ANDROID`
- `WEB`
- `UNKNOWN`

### PushProvider
- `APNS`
- `FCM`

### ProfileGender
- `WOMAN`
- `MAN`
- `NON_BINARY`
- `TRANS_WOMAN`
- `TRANS_MAN`
- `AGENDER`
- `OTHER`
- `PREFER_NOT_TO_SAY`

### ConnectionIntent
- `FRIENDSHIP`
- `COMPANIONSHIP`
- `SHARED_INTERESTS`
- `RELATIONSHIP`

### PhotoModerationStatus
- `PENDING`
- `APPROVED`
- `REJECTED`

### SmokingHabit
- `NEVER`
- `OCCASIONAL`
- `REGULAR`
- `PREFER_NOT_TO_SAY`

### DrinkingHabit
- `NEVER`
- `OCCASIONAL`
- `SOCIAL`
- `REGULAR`
- `PREFER_NOT_TO_SAY`

### ExerciseHabit
- `NEVER`
- `OCCASIONAL`
- `WEEKLY`
- `FREQUENT`

### DietPreference
- `OMNIVORE`
- `VEGETARIAN`
- `VEGAN`
- `PESCATARIAN`
- `HALAL`
- `KOSHER`
- `OTHER`
- `PREFER_NOT_TO_SAY`

### PetPreference
- `HAS_PETS`
- `LIKES_PETS`
- `NO_PETS`
- `ALLERGIC`
- `PREFER_NOT_TO_SAY`

### SleepPattern
- `EARLY_BIRD`
- `FLEXIBLE`
- `NIGHT_OWL`

### SocialEnergyLevel
- `LOW_KEY`
- `BALANCED`
- `OUTGOING`

### LikeStatus
- `ACTIVE`
- `MATCHED`
- `RETRACTED`

### MatchStatus
- `ACTIVE`
- `ENDED`

### MatchEndReason
- `UNMATCHED`
- `BLOCKED`
- `MODERATION`
- `ACCOUNT_DELETED`

### ConversationStatus
- `ACTIVE`
- `BLOCKED`
- `CLOSED_UNMATCHED`
- `CLOSED_MODERATION`

### ConversationCloseReason
- `BLOCKED`
- `UNMATCHED`
- `MODERATION`
- `ACCOUNT_DELETED`

### MessageType
- `TEXT`
- `IMAGE`
- `VIDEO`
- `AUDIO`
- `SYSTEM`

### ContentModerationStatus
- `PENDING`
- `APPROVED`
- `REJECTED`

### MessageStatus
- `ACTIVE`
- `PENDING_MODERATION`
- `REMOVED_BY_MODERATION`
- `DELETED_BY_SENDER`

### CallType
- `VOICE`
- `VIDEO`

### CallSessionStatus
- `RINGING`
- `ACCEPTED`
- `CONNECTING`
- `CONNECTED`
- `DECLINED`
- `CANCELED`
- `MISSED`
- `ENDED`
- `TIMED_OUT`
- `FAILED`

### CallEndReason
- `HANGUP`
- `DECLINED`
- `CANCELED`
- `MISSED`
- `BLOCKED`
- `UNMATCHED`
- `PERMISSION_REVOKED`
- `TIMEOUT`
- `ERROR`

### ReportTargetType
- `USER`
- `MESSAGE`
- `PROFILE_PHOTO`
- `CONVERSATION`
- `MATCH`
- `CALL_SESSION`

### ReportReasonCode
- `SPAM`
- `HARASSMENT`
- `INAPPROPRIATE_CONTENT`
- `FAKE_PROFILE`
- `UNDERAGE`
- `SAFETY_RISK`
- `OTHER`

### ReportStatus
- `OPEN`
- `UNDER_REVIEW`
- `ACTIONED`
- `CLOSED`
- `DUPLICATE`

### NotificationType
- `NEW_MATCH`
- `NEW_MESSAGE`
- `MISSED_CALL`
- `REPORT_UPDATE`
- `MODERATION_ACTION`
- `SYSTEM`

### NotificationStatus
- `PENDING`
- `SENT`
- `FAILED`
- `READ`
- `CANCELED`

### NotificationChannel
- `IN_APP`
- `PUSH`

### AnalyticsSource
- `MOBILE`
- `SYSTEM`
- `ADMIN`

---

## Profile Completion Criteria

The profile is considered **complete** when all of the following are satisfied:

```typescript
type ProfileCompletionCriterion = 
  | "DISPLAY_NAME"                    // Non-empty, length >= 2
  | "BIO"                             // Length 20-1000 chars
  | "DATE_OF_BIRTH"                   // Required
  | "AGE_18_PLUS"                     // Must be >= 18 years old
  | "CITY"                            // Required
  | "REGION"                          // Required
  | "COUNTRY_CODE"                    // Required
  | "LOCATION_COORDINATES"            // Both lat and lng not null
  | "LOCATION_GEOHASH"                // Required
  | "INTENT"                          // At least 1 connection intent selected
  | "APPROVED_PHOTO"                  // At least 1 photo with APPROVED status
  | "APPROVED_PRIMARY_PHOTO"          // Primary photo must be APPROVED
  | "DISCOVERY_PREFERENCE"            // minAge >= 18, maxAge >= minAge, maxDistanceKm >= 1
  | "COMMUNICATION_PREFERENCE"        // Must be created/configured
  | "PROFILE_HIDDEN"                  // Profile cannot be hidden
  | "ACCOUNT_NOT_ACTIVE"              // Account status must be ACTIVE
```

---

## Error Response Structure

All HTTP errors follow this structure:

```typescript
interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;              // Error code from ERROR_CODES constant
  details?: Record<string, unknown>;
  requestId: string;         // Unique request ID from x-request-id header
  timestamp: string;         // ISO 8601 timestamp
}
```

### Error Codes

```typescript
VALIDATION_FAILED
INVALID_CURSOR
RATE_LIMIT_EXCEEDED
UNAUTHORIZED
SESSION_INVALID
FORBIDDEN
RESOURCE_NOT_FOUND
CONFLICT
IDEMPOTENCY_CONFLICT
INTERNAL_ERROR
AUTH_IDENTIFIER_REQUIRED
AUTH_IDENTIFIER_TAKEN
AUTH_PASSWORD_WEAK
AUTH_INVALID_CREDENTIALS
AUTH_REFRESH_INVALID
AUTH_REFRESH_REPLAY_DETECTED
AUTH_ACCOUNT_RESTRICTED
AUTH_ACCOUNT_SUSPENDED
AUTH_ACCOUNT_BANNED
SESSION_NOT_FOUND
SESSION_NOT_OWNED
PUSH_TOKEN_INVALID
PROFILE_NOT_FOUND
PROFILE_LOCATION_REQUIRED
PROFILE_AGE_RESTRICTED
PROFILE_COMPLETION_REQUIRED
PROFILE_PHOTO_INVALID_TYPE
PROFILE_PHOTO_TOO_LARGE
PROFILE_PHOTO_NOT_FOUND
PROFILE_PHOTO_NOT_OWNED
PROFILE_PHOTO_PENDING_MODERATION
PROFILE_PHOTO_REJECTED
PROFILE_PHOTO_PRIMARY_REQUIRED
PROFILE_PHOTO_ORDER_INVALID
INTEREST_TAG_NOT_FOUND
INTENT_REQUIRED
DISCOVERY_NOT_AVAILABLE
DISCOVERY_PROFILE_INCOMPLETE
DISCOVERY_ACCOUNT_RESTRICTED
LIKE_SELF_FORBIDDEN
LIKE_TARGET_NOT_ELIGIBLE
LIKE_BLOCKED
LIKE_ALREADY_RETRACTED
PASS_SELF_FORBIDDEN
MATCH_NOT_FOUND
MATCH_NOT_ACTIVE
MATCH_COMMUNICATION_FORBIDDEN
BLOCK_SELF_FORBIDDEN
BLOCK_ALREADY_ACTIVE
CONVERSATION_NOT_FOUND
CONVERSATION_NOT_ACCESSIBLE
CONVERSATION_CLOSED
MESSAGE_NOT_FOUND
MESSAGE_NOT_OWNED
MESSAGE_TEXT_REQUIRED
MESSAGE_ATTACHMENT_REQUIRED
MESSAGE_ATTACHMENT_INVALID_TYPE
MESSAGE_ATTACHMENT_TOO_LARGE
MESSAGE_ATTACHMENT_UPLOAD_INVALID
MESSAGE_EDIT_WINDOW_EXPIRED
MESSAGE_ALREADY_DELETED
READ_SEQUENCE_INVALID
CALL_NOT_FOUND
CALL_NOT_RINGING
CALL_NOT_ACTIVE
CALL_PERMISSION_DENIED
CALL_CONFLICT_ACTIVE_EXISTS
CALL_ALREADY_ACCEPTED
CALL_STALE_SIGNAL
CALL_SIGNAL_INVALID
REPORT_INVALID_TARGET
REPORT_DUPLICATE
MODERATION_CASE_NOT_FOUND
MODERATION_ACTION_INVALID
ADMIN_ROLE_REQUIRED
FEATURE_FLAG_NOT_FOUND
```

---

## Key DTO Shapes for React Native Client

### `AuthResponseDto`
```typescript
{
  tokens: TokenPairDto;
  user: CurrentUserDto;
  profileCompletion: ProfileCompletionStatusDto;
}
```

### `CurrentUserDto`
```typescript
{
  id: string;                      // UUID
  email: string | null;
  phone: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  status: "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "BANNED" | "DELETED";
  isShadowBanned: boolean;
  isDiscoveryFrozen: boolean;
  isChatFrozen: boolean;
  isCallFrozen: boolean;
  lastActiveAt: string | null;     // ISO 8601
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `TokenPairDto`
```typescript
{
  accessToken: string;
  accessTokenExpiresAt: string;    // ISO 8601
  refreshToken: string;
  refreshTokenExpiresAt: string;   // ISO 8601
  session: SessionDto;
}
```

### `SessionDto`
```typescript
{
  id: string;                      // UUID
  deviceId: string | null;
  deviceName: string | null;
  platform: "IOS" | "ANDROID" | "WEB" | "UNKNOWN";
  appVersion: string | null;
  lastSeenAt: string | null;       // ISO 8601
  createdAt: string;               // ISO 8601
  revokedAt: string | null;        // ISO 8601
  isCurrent: boolean;
}
```

### `MyProfileDto`
```typescript
{
  userId: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  dateOfBirth: string | null;      // ISO 8601
  gender: ProfileGenderValue | null;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;      // 2-char ISO 3166-1 alpha-2
  hideAge: boolean;
  hideDistance: boolean;
  isHidden: boolean;
  isComplete: boolean;
  completedAt: string | null;      // ISO 8601
  photos: PrivatePhotoDto[];
  intents: ConnectionIntentValue[];
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  schedulePreference: SchedulePreferenceDto;
  discoveryPreference: DiscoveryPreferenceDto;
  communicationPreference: CommunicationPreferenceDto;
  completion: ProfileCompletionStatusDto;
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `ProfilePhotoDto` (Private)
```typescript
{
  id: string;                      // UUID
  objectKey: string;
  bucket: string;
  mimeType: string;                // "image/jpeg" | "image/png" | "image/webp"
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  moderationReason: string | null;
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `DiscoveryItemDto` (PublicProfileDto)
```typescript
{
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  age: number;
  gender: ProfileGenderValue | null;
  pronouns: string | null;
  location: {
    city: string | null;
    region: string | null;
    countryCode: string | null;
    distanceKmRounded: number;
    distanceBand: "LOCAL" | "NEARBY" | "CITY_EDGE" | "REGIONAL" | null;
  };
  intents: ConnectionIntentValue[];
  interests: InterestTagDto[];
  lifestyle: LifestyleDto;
  photos: PublicPhotoDto[];  // { id, url, width?, height?, isPrimary, position }
}
```

### `MatchDto` (MatchSummaryDto or MatchDetailDto)
```typescript
{
  id: string;                      // UUID
  status: "ACTIVE" | "ENDED";
  matchedAt: string;               // ISO 8601
  endedAt: string | null;          // ISO 8601
  endedReason: "UNMATCHED" | "BLOCKED" | "MODERATION" | "ACCOUNT_DELETED" | null;
  otherUser: PublicProfileDto;
  conversationId: string | null;   // UUID
  myCommunicationSetting: {
    matchId: string;
    userId: string;
    allowVoiceCalls: boolean;
    allowVideoCalls: boolean;
    muted: boolean;
    updatedAt: string;             // ISO 8601
  };
  lastMessagePreview: string | null;
  lastMessageSentAt: string | null; // ISO 8601
  otherUserCommunicationAllowed?: {  // (Only in detail)
    allowVoiceCalls: boolean;
    allowVideoCalls: boolean;
  };
}
```

### `ConversationDto` (ConversationSummaryDto)
```typescript
{
  id: string;                      // UUID
  matchId: string;
  status: "ACTIVE" | "BLOCKED" | "CLOSED_UNMATCHED" | "CLOSED_MODERATION";
  otherUser: PublicProfileDto;
  lastMessageSequence: number;
  lastMessagePreview: string | null;
  lastMessageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM" | null;
  lastMessageSentAt: string | null; // ISO 8601
  lastSenderId: string | null;
  lastReadSequence: number;
  unreadCount: number;
  closedAt: string | null;         // ISO 8601
  closedReason: "BLOCKED" | "UNMATCHED" | "MODERATION" | "ACCOUNT_DELETED" | null;
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `MessageDto`
```typescript
{
  id: string;                      // UUID
  conversationId: string;
  senderId: string;
  sequence: number;
  clientMessageId: string | null;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "SYSTEM";
  textBody: string | null;
  attachment: {
    objectKey: string | null;
    url: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  };
  status: "ACTIVE" | "PENDING_MODERATION" | "REMOVED_BY_MODERATION" | "DELETED_BY_SENDER";
  replyToMessageId: string | null;
  editedAt: string | null;         // ISO 8601
  deletedAt: string | null;        // ISO 8601
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `CallSessionDto`
```typescript
{
  id: string;                      // UUID
  matchId: string;
  conversationId: string;
  initiatorUserId: string;
  receiverUserId: string;
  callType: "VOICE" | "VIDEO";
  status: "RINGING" | "ACCEPTED" | "CONNECTING" | "CONNECTED" | "DECLINED" | "CANCELED" | "MISSED" | "ENDED" | "TIMED_OUT" | "FAILED";
  signalingVersion: number;
  ringStartedAt: string | null;    // ISO 8601
  acceptedAt: string | null;       // ISO 8601
  connectedAt: string | null;      // ISO 8601
  endedAt: string | null;          // ISO 8601
  expiresAt: string;               // ISO 8601
  endReason: "HANGUP" | "DECLINED" | "CANCELED" | "MISSED" | "BLOCKED" | "UNMATCHED" | "PERMISSION_REVOKED" | "TIMEOUT" | "ERROR" | null;
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `NotificationDto`
```typescript
{
  id: string;                      // UUID
  type: "NEW_MATCH" | "NEW_MESSAGE" | "MISSED_CALL" | "REPORT_UPDATE" | "MODERATION_ACTION" | "SYSTEM";
  channel: "IN_APP" | "PUSH";
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: "PENDING" | "SENT" | "FAILED" | "READ" | "CANCELED";
  readAt: string | null;           // ISO 8601
  sentAt: string | null;           // ISO 8601
  createdAt: string;               // ISO 8601
}
```

### `BlockedUserDto` (BlockDto)
```typescript
{
  id: string;                      // UUID
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
}
```

### `ReportDto`
```typescript
{
  id: string;                      // UUID
  reporterUserId: string;
  reportedUserId: string;
  targetType: "USER" | "MESSAGE" | "PROFILE_PHOTO" | "CONVERSATION" | "MATCH" | "CALL_SESSION";
  reasonCode: "SPAM" | "HARASSMENT" | "INAPPROPRIATE_CONTENT" | "FAKE_PROFILE" | "UNDERAGE" | "SAFETY_RISK" | "OTHER";
  description: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "ACTIONED" | "CLOSED" | "DUPLICATE";
  createdAt: string;               // ISO 8601
  closedAt: string | null;         // ISO 8601
}
```

### `InterestTagDto`
```typescript
{
  id: string;                      // UUID
  slug: string;
  displayName: string;
  category: string | null;
}
```

### Additional Preference DTOs

#### `LifestyleDto`
```typescript
{
  smoking: "NEVER" | "OCCASIONAL" | "REGULAR" | "PREFER_NOT_TO_SAY" | null;
  drinking: "NEVER" | "OCCASIONAL" | "SOCIAL" | "REGULAR" | "PREFER_NOT_TO_SAY" | null;
  exercise: "NEVER" | "OCCASIONAL" | "WEEKLY" | "FREQUENT" | null;
  diet: "OMNIVORE" | "VEGETARIAN" | "VEGAN" | "PESCATARIAN" | "HALAL" | "KOSHER" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  petPreference: "HAS_PETS" | "LIKES_PETS" | "NO_PETS" | "ALLERGIC" | "PREFER_NOT_TO_SAY" | null;
  sleepPattern: "EARLY_BIRD" | "FLEXIBLE" | "NIGHT_OWL" | null;
  socialEnergy: "LOW_KEY" | "BALANCED" | "OUTGOING" | null;
}
```

#### `DiscoveryPreferenceDto`
```typescript
{
  minAge: number | null;
  maxAge: number | null;
  maxDistanceKm: number | null;
  intentFilter: ConnectionIntentValue[];
  preferredGenders: ProfileGenderValue[];
  includeRecentlyActiveOnly: boolean;
  preferSameCity: boolean;
}
```

#### `CommunicationPreferenceDto`
```typescript
{
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  allowPushMatches: boolean;
  allowPushMessages: boolean;
  allowPushCalls: boolean;
  allowReadReceipts: boolean;
}
```

#### `SchedulePreferenceDto`
```typescript
{
  weekdayMask: number;
  timeBlockMask: number;
  prefersWeekends: boolean;
  remoteFriendly: boolean;
  maxMeetupsPerWeek: number | null;
  preferredLeadTimeDays: number | null;
  timezone: string | null;
}
```

#### `ProfileCompletionStatusDto`
```typescript
{
  isComplete: boolean;
  completedAt: string | null;      // ISO 8601
  missingCriteria: ProfileCompletionCriterion[];
}
```

---

## Request/Response Validation Notes

### Global Validation Pipe Configuration
- **Whitelist**: Enabled (non-listed properties are removed)
- **Forbid Non-whitelisted**: Enabled (non-listed properties cause errors)
- **Transform**: Enabled (implicit conversion disabled for security)

### Common Query Parameters
- **cursor**: Optional string for pagination
- **limit**: Optional integer, clamped to max (typically 50 or 100)

### Rate Limiting
- **Auth endpoints** (`/auth/signup`, `/auth/login`): 10 req/min per IP
- **Auth refresh**: 30 req/min per IP
- **Profile photo upload/finalize**: 20 req/min per IP
- **Reports**: 10 req/min per IP
- **Analytics**: 60 req/min per session
- **Message attachment upload/finalize**: 20 req/min per IP
- **Messages**: No explicit limit per endpoint but subject to validation

### Timestamp Format
All timestamps in responses are ISO 8601 format (e.g., `2026-05-03T10:30:00.000Z`)

### Coordinate Validation
- Latitude: -90 to +90
- Longitude: -180 to +180
- Country code: 2-character ISO 3166-1 alpha-2 code

### File Upload Constraints
- **Profile photos**: JPEG, PNG, WebP; max 10 MB
- **Message attachments**: JPEG/PNG/WebP (images), MP4/MOV (video), MP3/M4A/AAC/WAV (audio); max 50 MB
- **Message text**: Max 5000 characters
- **Profile bio**: 20-1000 characters

---

## Key Implementation Notes

1. **Idempotency**: `POST /likes` accepts optional `Idempotency-Key` header for deduplication
2. **Request Tracking**: All requests include `x-request-id` header (user-provided or auto-generated UUID)
3. **Protected Endpoints**: Require valid JWT access token in `Authorization: Bearer <token>` header
4. **Session Binding**: WebSocket and sensitive operations verify session ID matches current user context
5. **Cursor Pagination**: Cursors are opaque; clients should not construct them
6. **Location Updates**: Profile location requires coordinates and geohash together
7. **Message Sequences**: Conversations maintain monotonically increasing message sequence numbers
8. **Photo Moderation**: Photos must be APPROVED before profile can be marked complete; rejected photos cannot be reused

