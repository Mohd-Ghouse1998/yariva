# Phase 1 Addendum: Finalized Transport And Policy Contracts

This addendum finalizes the remaining contracts before code generation.

Hard rules
- No schema model names changed.
- No NestJS module names changed.
- Two public API additions are required for the already-approved design to be implementable:
  - `GET /conversations/:conversationId/messages`
  - `POST /messages/attachments/upload`

## 1. Exact REST API Request / Response DTOs

### 1.1 Global transport conventions

- Base URL prefix: `/api/v1`
- Auth header: `Authorization: Bearer <accessToken>`
- Idempotency header where supported: `Idempotency-Key: <opaque-string>`
- All ids are UUID strings.
- All timestamps are ISO-8601 UTC strings.
- All enums are string literals matching Prisma enum names.
- Cursor pagination shape is fixed:

```json
{
  "items": [],
  "nextCursor": "opaque-string-or-null"
}
```

- Standard REST error shape is fixed:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "requestId": "uuid",
    "details": {}
  }
}
```

### 1.2 Shared DTOs

#### DeviceContextDto

```json
{
  "deviceId": "string|null",
  "deviceName": "string|null",
  "platform": "IOS|ANDROID|WEB|UNKNOWN",
  "appVersion": "string|null"
}
```

#### SessionDto

```json
{
  "id": "uuid",
  "deviceId": "string|null",
  "deviceName": "string|null",
  "platform": "IOS|ANDROID|WEB|UNKNOWN",
  "appVersion": "string|null",
  "lastSeenAt": "timestamp|null",
  "createdAt": "timestamp",
  "revokedAt": "timestamp|null",
  "isCurrent": true
}
```

#### TokenPairDto

```json
{
  "accessToken": "string",
  "accessTokenExpiresAt": "timestamp",
  "refreshToken": "string",
  "refreshTokenExpiresAt": "timestamp",
  "session": {
    "id": "uuid",
    "deviceId": "string|null",
    "deviceName": "string|null",
    "platform": "IOS|ANDROID|WEB|UNKNOWN",
    "appVersion": "string|null",
    "lastSeenAt": "timestamp|null",
    "createdAt": "timestamp",
    "revokedAt": null,
    "isCurrent": true
  }
}
```

#### CurrentUserDto

```json
{
  "id": "uuid",
  "email": "string|null",
  "phone": "string|null",
  "role": "USER|MODERATOR|ADMIN",
  "status": "ACTIVE|RESTRICTED|SUSPENDED|BANNED|DELETED",
  "isShadowBanned": false,
  "isDiscoveryFrozen": false,
  "isChatFrozen": false,
  "isCallFrozen": false,
  "lastActiveAt": "timestamp|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### PublicPhotoDto

```json
{
  "id": "uuid",
  "url": "string",
  "width": 1080,
  "height": 1350,
  "isPrimary": true,
  "position": 0
}
```

#### PrivatePhotoDto

```json
{
  "id": "uuid",
  "objectKey": "string",
  "bucket": "string",
  "mimeType": "string",
  "sizeBytes": 123456,
  "width": 1080,
  "height": 1350,
  "position": 0,
  "isPrimary": true,
  "moderationStatus": "PENDING|APPROVED|REJECTED",
  "moderationReason": "string|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### LocationSummaryDto

```json
{
  "city": "string|null",
  "region": "string|null",
  "countryCode": "string|null",
  "distanceKmRounded": 12,
  "distanceBand": "LOCAL|NEARBY|CITY_EDGE|REGIONAL|null"
}
```

#### InterestTagDto

```json
{
  "id": "uuid",
  "slug": "hiking",
  "displayName": "Hiking",
  "category": "outdoors|null"
}
```

#### LifestyleDto

```json
{
  "smoking": "NEVER|OCCASIONAL|REGULAR|PREFER_NOT_TO_SAY|null",
  "drinking": "NEVER|OCCASIONAL|SOCIAL|REGULAR|PREFER_NOT_TO_SAY|null",
  "exercise": "NEVER|OCCASIONAL|WEEKLY|FREQUENT|null",
  "diet": "OMNIVORE|VEGETARIAN|VEGAN|PESCATARIAN|HALAL|KOSHER|OTHER|PREFER_NOT_TO_SAY|null",
  "petPreference": "HAS_PETS|LIKES_PETS|NO_PETS|ALLERGIC|PREFER_NOT_TO_SAY|null",
  "sleepPattern": "EARLY_BIRD|FLEXIBLE|NIGHT_OWL|null",
  "socialEnergy": "LOW_KEY|BALANCED|OUTGOING|null"
}
```

#### SchedulePreferenceDto

```json
{
  "weekdayMask": 62,
  "timeBlockMask": 240,
  "prefersWeekends": true,
  "remoteFriendly": false,
  "maxMeetupsPerWeek": 3,
  "preferredLeadTimeDays": 2,
  "timezone": "Asia/Kolkata|null"
}
```

#### DiscoveryPreferenceDto

```json
{
  "minAge": 24,
  "maxAge": 36,
  "maxDistanceKm": 50,
  "intentFilter": ["FRIENDSHIP", "RELATIONSHIP"],
  "preferredGenders": ["WOMAN", "NON_BINARY"],
  "includeRecentlyActiveOnly": false,
  "preferSameCity": true
}
```

#### CommunicationPreferenceDto

```json
{
  "allowVoiceCalls": true,
  "allowVideoCalls": true,
  "allowPushMatches": true,
  "allowPushMessages": true,
  "allowPushCalls": true,
  "allowReadReceipts": true
}
```

#### ProfileCompletionStatusDto

```json
{
  "isComplete": false,
  "completedAt": "timestamp|null",
  "missingCriteria": [
    "DISPLAY_NAME",
    "BIO",
    "APPROVED_PRIMARY_PHOTO"
  ]
}
```

#### MyProfileDto

```json
{
  "userId": "uuid",
  "displayName": "string|null",
  "headline": "string|null",
  "bio": "string|null",
  "dateOfBirth": "timestamp|null",
  "gender": "WOMAN|MAN|NON_BINARY|TRANS_WOMAN|TRANS_MAN|AGENDER|OTHER|PREFER_NOT_TO_SAY|null",
  "pronouns": "string|null",
  "city": "string|null",
  "region": "string|null",
  "countryCode": "string|null",
  "hideAge": false,
  "hideDistance": false,
  "isHidden": false,
  "isComplete": false,
  "completedAt": "timestamp|null",
  "photos": [],
  "intents": ["FRIENDSHIP"],
  "interests": [],
  "lifestyle": {},
  "schedulePreference": {},
  "discoveryPreference": {},
  "communicationPreference": {},
  "completion": {
    "isComplete": false,
    "completedAt": null,
    "missingCriteria": []
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### PublicProfileDto

```json
{
  "userId": "uuid",
  "displayName": "string",
  "headline": "string|null",
  "bio": "string|null",
  "age": 29,
  "gender": "WOMAN|MAN|NON_BINARY|TRANS_WOMAN|TRANS_MAN|AGENDER|OTHER|PREFER_NOT_TO_SAY|null",
  "pronouns": "string|null",
  "location": {
    "city": "string|null",
    "region": "string|null",
    "countryCode": "string|null",
    "distanceKmRounded": 12,
    "distanceBand": "LOCAL|NEARBY|CITY_EDGE|REGIONAL|null"
  },
  "intents": ["FRIENDSHIP"],
  "interests": [],
  "lifestyle": {},
  "photos": []
}
```

#### MatchCommunicationSettingDto

```json
{
  "matchId": "uuid",
  "userId": "uuid",
  "allowVoiceCalls": true,
  "allowVideoCalls": true,
  "muted": false,
  "updatedAt": "timestamp"
}
```

#### MatchSummaryDto

```json
{
  "id": "uuid",
  "status": "ACTIVE|ENDED",
  "matchedAt": "timestamp",
  "endedAt": "timestamp|null",
  "endedReason": "UNMATCHED|BLOCKED|MODERATION|ACCOUNT_DELETED|null",
  "otherUser": {},
  "conversationId": "uuid|null",
  "myCommunicationSetting": {},
  "lastMessagePreview": "string|null",
  "lastMessageSentAt": "timestamp|null"
}
```

#### ConversationSummaryDto

```json
{
  "id": "uuid",
  "matchId": "uuid",
  "status": "ACTIVE|BLOCKED|CLOSED_UNMATCHED|CLOSED_MODERATION",
  "otherUser": {},
  "lastMessageSequence": 15,
  "lastMessagePreview": "string|null",
  "lastMessageType": "TEXT|IMAGE|VIDEO|AUDIO|SYSTEM|null",
  "lastMessageSentAt": "timestamp|null",
  "lastSenderId": "uuid|null",
  "lastReadSequence": 12,
  "unreadCount": 3,
  "closedAt": "timestamp|null",
  "closedReason": "BLOCKED|UNMATCHED|MODERATION|ACCOUNT_DELETED|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### MessageDto

```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "sequence": 16,
  "clientMessageId": "string|null",
  "type": "TEXT|IMAGE|VIDEO|AUDIO|SYSTEM",
  "textBody": "string|null",
  "attachment": {
    "objectKey": "string|null",
    "url": "string|null",
    "mimeType": "string|null",
    "sizeBytes": 12345,
    "width": 1080,
    "height": 1350,
    "durationSeconds": 18,
    "moderationStatus": "PENDING|APPROVED|REJECTED|null"
  },
  "status": "ACTIVE|PENDING_MODERATION|REMOVED_BY_MODERATION|DELETED_BY_SENDER",
  "replyToMessageId": "uuid|null",
  "editedAt": "timestamp|null",
  "deletedAt": "timestamp|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### ConversationReadDto

```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "lastReadMessageId": "uuid|null",
  "lastReadSequence": 16,
  "lastReadAt": "timestamp"
}
```

#### CallSessionDto

```json
{
  "id": "uuid",
  "matchId": "uuid",
  "conversationId": "uuid",
  "initiatorUserId": "uuid",
  "receiverUserId": "uuid",
  "callType": "VOICE|VIDEO",
  "status": "RINGING|ACCEPTED|CONNECTING|CONNECTED|DECLINED|CANCELED|MISSED|ENDED|TIMED_OUT|FAILED",
  "signalingVersion": 1,
  "ringStartedAt": "timestamp|null",
  "acceptedAt": "timestamp|null",
  "connectedAt": "timestamp|null",
  "endedAt": "timestamp|null",
  "expiresAt": "timestamp",
  "endReason": "HANGUP|DECLINED|CANCELED|MISSED|BLOCKED|UNMATCHED|PERMISSION_REVOKED|TIMEOUT|ERROR|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### NotificationDto

```json
{
  "id": "uuid",
  "type": "NEW_MATCH|NEW_MESSAGE|MISSED_CALL|REPORT_UPDATE|MODERATION_ACTION|SYSTEM",
  "channel": "IN_APP|PUSH",
  "title": "string",
  "body": "string",
  "data": {},
  "status": "PENDING|SENT|FAILED|READ|CANCELED",
  "readAt": "timestamp|null",
  "sentAt": "timestamp|null",
  "createdAt": "timestamp"
}
```

#### ReportDto

```json
{
  "id": "uuid",
  "reporterUserId": "uuid",
  "reportedUserId": "uuid",
  "targetType": "USER|MESSAGE|PROFILE_PHOTO|CONVERSATION|MATCH|CALL_SESSION",
  "reasonCode": "SPAM|HARASSMENT|INAPPROPRIATE_CONTENT|FAKE_PROFILE|UNDERAGE|SAFETY_RISK|OTHER",
  "description": "string|null",
  "status": "OPEN|UNDER_REVIEW|ACTIONED|CLOSED|DUPLICATE",
  "createdAt": "timestamp",
  "closedAt": "timestamp|null"
}
```

#### BlockDto

```json
{
  "id": "uuid",
  "blockerId": "uuid",
  "blockedId": "uuid",
  "reason": "string|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 1.3 Auth REST contracts

#### `POST /auth/signup`

Request

```json
{
  "email": "string|null",
  "phone": "string|null",
  "password": "string",
  "device": {
    "deviceId": "string|null",
    "deviceName": "string|null",
    "platform": "IOS|ANDROID|WEB|UNKNOWN",
    "appVersion": "string|null"
  }
}
```

Rules
- At least one of `email` or `phone` is required.
- `password` is required.

Response `201`

```json
{
  "tokens": {},
  "user": {},
  "profileCompletion": {}
}
```

#### `POST /auth/login`

Request

```json
{
  "identifier": "string",
  "password": "string",
  "device": {
    "deviceId": "string|null",
    "deviceName": "string|null",
    "platform": "IOS|ANDROID|WEB|UNKNOWN",
    "appVersion": "string|null"
  }
}
```

Response `200`

```json
{
  "tokens": {},
  "user": {},
  "profileCompletion": {}
}
```

#### `POST /auth/refresh`

Request

```json
{
  "refreshToken": "string"
}
```

Response `200`

```json
{
  "tokens": {},
  "user": {}
}
```

#### `POST /auth/logout`

Request

```json
{}
```

Response `204`

### 1.4 Sessions REST contracts

#### `GET /sessions`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

#### `DELETE /sessions/:sessionId`

Response `204`

#### `DELETE /sessions/others`

Response `200`

```json
{
  "revokedCount": 2
}
```

#### `POST /push-tokens`

Request

```json
{
  "token": "string",
  "platform": "IOS|ANDROID|WEB|UNKNOWN",
  "provider": "APNS|FCM",
  "deviceId": "string|null"
}
```

Response `200`

```json
{
  "id": "uuid",
  "token": "string",
  "platform": "IOS|ANDROID|WEB|UNKNOWN",
  "provider": "APNS|FCM",
  "deviceId": "string|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### `DELETE /push-tokens/:tokenId`

Response `204`

### 1.5 Users REST contracts

#### `GET /users/me`

Response `200`

```json
{
  "user": {},
  "profileCompletion": {}
}
```

### 1.6 Profiles REST contracts

#### `GET /profiles/me`

Response `200`

```json
{
  "profile": {}
}
```

#### `PATCH /profiles/me`

Request

```json
{
  "displayName": "string|null",
  "headline": "string|null",
  "bio": "string|null",
  "dateOfBirth": "timestamp|null",
  "gender": "WOMAN|MAN|NON_BINARY|TRANS_WOMAN|TRANS_MAN|AGENDER|OTHER|PREFER_NOT_TO_SAY|null",
  "pronouns": "string|null",
  "city": "string|null",
  "region": "string|null",
  "countryCode": "string|null",
  "location": {
    "lat": 12.9716,
    "lng": 77.5946
  },
  "hideAge": false,
  "hideDistance": false,
  "isHidden": false
}
```

Response `200`

```json
{
  "profile": {}
}
```

#### `POST /profiles/photos/upload`

Request

```json
{
  "fileName": "string",
  "mimeType": "image/jpeg|image/png|image/webp",
  "sizeBytes": 1048576,
  "sha256": "string|null"
}
```

Response `200`

```json
{
  "uploadToken": "string",
  "objectKey": "string",
  "bucket": "profile-photos",
  "method": "PUT",
  "uploadUrl": "string",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "expiresAt": "timestamp",
  "maxSizeBytes": 10485760
}
```

#### `POST /profiles/photos/finalize`

Request

```json
{
  "uploadToken": "string",
  "objectKey": "string",
  "bucket": "profile-photos",
  "mimeType": "image/jpeg|image/png|image/webp",
  "sizeBytes": 1048576,
  "width": 1080,
  "height": 1350,
  "sha256": "string|null",
  "position": 0
}
```

Response `201`

```json
{
  "photo": {},
  "profileCompletion": {}
}
```

#### `PATCH /profiles/photos/order`

Request

```json
{
  "orderedPhotoIds": ["uuid", "uuid"]
}
```

Response `200`

```json
{
  "photos": [{}]
}
```

#### `PATCH /profiles/photos/:photoId/primary`

Request

```json
{}
```

Response `200`

```json
{
  "photo": {}
}
```

#### `DELETE /profiles/photos/:photoId`

Response `204`

#### `PUT /profiles/me/lifestyle`

Request and response body

```json
{}
```

#### `PUT /profiles/me/schedule-preference`

Request and response body

```json
{}
```

#### `PUT /profiles/me/discovery-preference`

Request and response body

```json
{}
```

#### `PUT /profiles/me/communication-preference`

Request and response body

```json
{}
```

The exact response for the four `PUT` endpoints above is:

```json
{
  "value": {}
}
```

Where:
- lifestyle endpoint uses `LifestyleDto`
- schedule endpoint uses `SchedulePreferenceDto`
- discovery endpoint uses `DiscoveryPreferenceDto`
- communication endpoint uses `CommunicationPreferenceDto`

### 1.7 Interests REST contracts

#### `GET /interests`

Query
- `cursor?: string`
- `limit?: number` default `50`, max `100`
- `search?: string`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

#### `PUT /users/me/interests`

Request

```json
{
  "interestTagIds": ["uuid", "uuid"]
}
```

Response `200`

```json
{
  "interests": [{}]
}
```

#### `PUT /users/me/intents`

Request

```json
{
  "intents": ["FRIENDSHIP", "SHARED_INTERESTS"]
}
```

Response `200`

```json
{
  "intents": ["FRIENDSHIP", "SHARED_INTERESTS"],
  "profileCompletion": {}
}
```

### 1.8 Discovery REST contracts

#### `GET /discovery/feed`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [
    {
      "userId": "uuid",
      "displayName": "string",
      "headline": "string|null",
      "bio": "string|null",
      "age": 29,
      "gender": "WOMAN|MAN|NON_BINARY|TRANS_WOMAN|TRANS_MAN|AGENDER|OTHER|PREFER_NOT_TO_SAY|null",
      "pronouns": "string|null",
      "location": {},
      "intents": ["FRIENDSHIP"],
      "interests": [],
      "lifestyle": {},
      "photos": []
    }
  ],
  "nextCursor": "string|null",
  "snapshotExpiresAt": "timestamp"
}
```

### 1.9 Likes and passes REST contracts

#### `POST /likes`

Request

```json
{
  "targetUserId": "uuid"
}
```

Response `200`

```json
{
  "outcome": "LIKE_RECORDED|MATCH_CREATED",
  "like": {
    "id": "uuid",
    "actorId": "uuid",
    "targetId": "uuid",
    "status": "ACTIVE|MATCHED|RETRACTED",
    "matchedAt": "timestamp|null",
    "retractedAt": "timestamp|null",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  },
  "match": {},
  "conversation": {}
}
```

Rules
- `match` and `conversation` are `null` unless `outcome = MATCH_CREATED`.

#### `DELETE /likes/:targetUserId`

Response `204`

#### `POST /passes`

Request

```json
{
  "targetUserId": "uuid"
}
```

Response `200`

```json
{
  "id": "uuid",
  "actorId": "uuid",
  "targetId": "uuid",
  "expiresAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### `DELETE /passes/:targetUserId`

Response `204`

### 1.10 Matches REST contracts

#### `GET /matches`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

#### `GET /matches/:matchId`

Response `200`

```json
{
  "match": {
    "id": "uuid",
    "status": "ACTIVE|ENDED",
    "matchedAt": "timestamp",
    "endedAt": "timestamp|null",
    "endedReason": "UNMATCHED|BLOCKED|MODERATION|ACCOUNT_DELETED|null",
    "otherUser": {},
    "conversationId": "uuid|null",
    "myCommunicationSetting": {},
    "otherUserCommunicationAllowed": {
      "allowVoiceCalls": true,
      "allowVideoCalls": false
    }
  }
}
```

#### `DELETE /matches/:matchId`

Response `200`

```json
{
  "match": {}
}
```

#### `PUT /matches/:matchId/communication-settings/me`

Request

```json
{
  "allowVoiceCalls": true,
  "allowVideoCalls": false,
  "muted": false
}
```

Response `200`

```json
{
  "setting": {}
}
```

### 1.11 Conversations and messages REST contracts

#### `GET /conversations`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

#### `GET /conversations/:conversationId`

Response `200`

```json
{
  "conversation": {}
}
```

#### `GET /conversations/:conversationId/messages`

Query
- `cursor?: string`
- `limit?: number` default `50`, max `100`

Cursor ordering
- messages are returned newest-first in pages
- each item still contains ascending `sequence`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

#### `POST /conversations/:conversationId/read`

Request

```json
{
  "lastReadSequence": 16
}
```

Response `200`

```json
{
  "readState": {}
}
```

#### `POST /messages/attachments/upload`

Request

```json
{
  "conversationId": "uuid",
  "mimeType": "image/jpeg|image/png|image/webp|video/mp4|video/quicktime|audio/mpeg|audio/mp4|audio/aac|audio/wav",
  "sizeBytes": 1048576,
  "fileName": "string",
  "sha256": "string|null"
}
```

Response `200`

```json
{
  "uploadToken": "string",
  "objectKey": "string",
  "bucket": "message-attachments",
  "method": "PUT",
  "uploadUrl": "string",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "expiresAt": "timestamp"
}
```

#### `POST /conversations/:conversationId/messages`

This endpoint is for `TEXT` messages only.

Request

```json
{
  "clientMessageId": "string",
  "textBody": "string",
  "replyToMessageId": "uuid|null"
}
```

Response `201`

```json
{
  "message": {}
}
```

#### `POST /messages/attachments/finalize`

Request

```json
{
  "conversationId": "uuid",
  "clientMessageId": "string",
  "type": "IMAGE|VIDEO|AUDIO",
  "uploadToken": "string",
  "objectKey": "string",
  "bucket": "message-attachments",
  "mimeType": "string",
  "sizeBytes": 1048576,
  "width": 1080,
  "height": 1350,
  "durationSeconds": 18,
  "replyToMessageId": "uuid|null"
}
```

Response `201`

```json
{
  "message": {}
}
```

#### `PATCH /messages/:messageId`

Request

```json
{
  "textBody": "string"
}
```

Response `200`

```json
{
  "message": {}
}
```

#### `DELETE /messages/:messageId`

Response `204`

### 1.12 Calls REST contracts

#### `POST /calls`

Request

```json
{
  "matchId": "uuid",
  "callType": "VOICE|VIDEO"
}
```

Response `201`

```json
{
  "call": {},
  "iceServers": [
    {
      "urls": ["stun:example.org:3478"]
    },
    {
      "urls": ["turn:example.org:3478?transport=udp"],
      "username": "string",
      "credential": "string"
    }
  ]
}
```

#### `POST /calls/:callId/accept`

Request

```json
{}
```

Response `200`

```json
{
  "call": {},
  "iceServers": [
    {
      "urls": ["stun:example.org:3478"]
    }
  ]
}
```

#### `POST /calls/:callId/decline`

Request

```json
{}
```

Response `200`

```json
{
  "call": {}
}
```

#### `POST /calls/:callId/end`

Request

```json
{
  "reason": "HANGUP"
}
```

Response `200`

```json
{
  "call": {}
}
```

### 1.13 Notifications REST contracts

#### `GET /notifications`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

#### `POST /notifications/:notificationId/read`

Request

```json
{}
```

Response `200`

```json
{
  "notification": {}
}
```

### 1.14 Reports REST contracts

#### `POST /reports`

Request

```json
{
  "reportedUserId": "uuid",
  "targetType": "USER|MESSAGE|PROFILE_PHOTO|CONVERSATION|MATCH|CALL_SESSION",
  "reasonCode": "SPAM|HARASSMENT|INAPPROPRIATE_CONTENT|FAKE_PROFILE|UNDERAGE|SAFETY_RISK|OTHER",
  "description": "string|null",
  "targetMatchId": "uuid|null",
  "targetConversationId": "uuid|null",
  "targetMessageId": "uuid|null",
  "targetPhotoId": "uuid|null",
  "targetCallSessionId": "uuid|null"
}
```

Response `201`

```json
{
  "report": {},
  "isDuplicate": false,
  "moderationCaseCreated": true
}
```

#### `GET /reports/me`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

### 1.15 Blocks REST contracts

#### `POST /blocks`

Request

```json
{
  "blockedUserId": "uuid",
  "reason": "string|null"
}
```

Response `200`

```json
{
  "block": {}
}
```

#### `DELETE /blocks/:blockedUserId`

Response `204`

#### `GET /blocks`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`

Response `200`

```json
{
  "items": [{}],
  "nextCursor": "string|null"
}
```

### 1.16 Analytics REST contracts

#### `POST /analytics/events`

Request

```json
{
  "events": [
    {
      "clientEventId": "string|null",
      "eventName": "string",
      "occurredAt": "timestamp",
      "source": "MOBILE",
      "properties": {}
    }
  ]
}
```

Response `202`

```json
{
  "acceptedCount": 1
}
```

### 1.17 Admin REST contracts

#### `GET /admin/moderation/cases`

Query
- `cursor?: string`
- `limit?: number` default `20`, max `50`
- `status?: OPEN|IN_REVIEW|ACTIONED|CLOSED`
- `priority?: LOW|MEDIUM|HIGH|CRITICAL`

Response `200`

```json
{
  "items": [
    {
      "id": "uuid",
      "subjectUserId": "uuid",
      "sourceReportId": "uuid|null",
      "caseType": "USER_REPORT|PHOTO_REVIEW|TRUST_REVIEW|PROFILE_REVIEW|MESSAGE_REVIEW",
      "priority": "LOW|MEDIUM|HIGH|CRITICAL",
      "status": "OPEN|IN_REVIEW|ACTIONED|CLOSED",
      "assignedAdminUserId": "uuid|null",
      "summary": "string|null",
      "actionTaken": "NONE|NOTE_ONLY|WARN|REMOVE_PHOTO|HIDE_PROFILE|FREEZE_DISCOVERY|FREEZE_CHAT|FREEZE_CALLS|SHADOW_BAN|SUSPEND|BAN|RESTORE",
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "closedAt": "timestamp|null"
    }
  ],
  "nextCursor": "string|null"
}
```

#### `GET /admin/moderation/cases/:caseId`

Response `200`

```json
{
  "case": {
    "id": "uuid",
    "subjectUserId": "uuid",
    "sourceReportId": "uuid|null",
    "caseType": "USER_REPORT|PHOTO_REVIEW|TRUST_REVIEW|PROFILE_REVIEW|MESSAGE_REVIEW",
    "priority": "LOW|MEDIUM|HIGH|CRITICAL",
    "status": "OPEN|IN_REVIEW|ACTIONED|CLOSED",
    "assignedAdminUserId": "uuid|null",
    "summary": "string|null",
    "findings": {},
    "actionTaken": "NONE|NOTE_ONLY|WARN|REMOVE_PHOTO|HIDE_PROFILE|FREEZE_DISCOVERY|FREEZE_CHAT|FREEZE_CALLS|SHADOW_BAN|SUSPEND|BAN|RESTORE",
    "actionNotes": "string|null",
    "createdAt": "timestamp",
    "updatedAt": "timestamp",
    "closedAt": "timestamp|null"
  }
}
```

#### `POST /admin/moderation/cases/:caseId/assign`

Request

```json
{
  "assignedAdminUserId": "uuid"
}
```

Response `200`

```json
{
  "case": {}
}
```

#### `POST /admin/moderation/cases/:caseId/action`

Request

```json
{
  "action": "NOTE_ONLY|WARN|REMOVE_PHOTO|HIDE_PROFILE|FREEZE_DISCOVERY|FREEZE_CHAT|FREEZE_CALLS|SHADOW_BAN|SUSPEND|BAN|RESTORE",
  "actionNotes": "string|null"
}
```

Response `200`

```json
{
  "case": {}
}
```

#### `GET /admin/users/:userId`

Response `200`

```json
{
  "user": {},
  "profile": {},
  "trustScore": {
    "score": 70,
    "level": "HIGH",
    "factors": {},
    "lastComputedAt": "timestamp"
  }
}
```

#### `POST /admin/users/:userId/action`

Request

```json
{
  "action": "WARN|HIDE_PROFILE|FREEZE_DISCOVERY|FREEZE_CHAT|FREEZE_CALLS|SHADOW_BAN|SUSPEND|BAN|RESTORE",
  "actionNotes": "string|null"
}
```

Response `200`

```json
{
  "user": {}
}
```

#### `GET /admin/feature-flags`

Response `200`

```json
{
  "items": [
    {
      "id": "uuid",
      "key": "string",
      "description": "string|null",
      "scope": "GLOBAL|USER_PERCENTAGE|USER_ALLOWLIST",
      "enabled": true,
      "rolloutPercentage": 25,
      "variant": "string|null",
      "config": {},
      "allowlistUserIds": ["uuid"],
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "nextCursor": null
}
```

#### `PUT /admin/feature-flags/:key`

Request

```json
{
  "description": "string|null",
  "scope": "GLOBAL|USER_PERCENTAGE|USER_ALLOWLIST",
  "enabled": true,
  "rolloutPercentage": 50,
  "variant": "string|null",
  "config": {},
  "allowlistUserIds": ["uuid"]
}
```

Response `200`

```json
{
  "featureFlag": {
    "id": "uuid",
    "key": "string",
    "description": "string|null",
    "scope": "GLOBAL|USER_PERCENTAGE|USER_ALLOWLIST",
    "enabled": true,
    "rolloutPercentage": 50,
    "variant": "string|null",
    "config": {},
    "allowlistUserIds": ["uuid"],
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

#### `GET /admin/analytics/summary`

Query
- `window`: `24h|7d|30d`

Response `200`

```json
{
  "window": "7d",
  "metrics": {
    "signups": 100,
    "activeUsers": 450,
    "likes": 3200,
    "matches": 640,
    "messages": 18000,
    "reports": 40,
    "callAttempts": 90
  }
}
```

#### `GET /admin/audit-logs`

Query
- `cursor?: string`
- `limit?: number` default `50`, max `100`
- `actorUserId?: uuid`
- `targetUserId?: uuid`
- `entityType?: string`

Response `200`

```json
{
  "items": [
    {
      "id": "uuid",
      "actorUserId": "uuid|null",
      "actorSessionId": "uuid|null",
      "action": "string",
      "entityType": "string",
      "entityId": "string|null",
      "targetUserId": "uuid|null",
      "ipAddress": "string|null",
      "userAgent": "string|null",
      "metadata": {},
      "createdAt": "timestamp"
    }
  ],
  "nextCursor": "string|null"
}
```

## 2. Exact WebSocket Event Payloads

### 2.1 Connection contract

- Transport: NestJS WebSocket gateway
- Namespace: `/ws`
- Handshake auth payload:

```json
{
  "accessToken": "string",
  "sessionId": "uuid",
  "lastEventId": "string|null"
}
```

- Server welcome event: `system.ready`

```json
{
  "connectionId": "uuid",
  "userId": "uuid",
  "sessionId": "uuid",
  "serverTime": "timestamp"
}
```

- All client-emitted events use acknowledgment callbacks with one of:

```json
{
  "ok": true,
  "requestId": "string",
  "serverTime": "timestamp"
}
```

or

```json
{
  "ok": false,
  "requestId": "string",
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "requestId": "uuid",
    "details": {}
  }
}
```

### 2.2 Client to server events

#### `presence.heartbeat`

```json
{
  "requestId": "string",
  "status": "ONLINE"
}
```

#### `conversation.typing.start`

```json
{
  "requestId": "string",
  "conversationId": "uuid"
}
```

#### `conversation.typing.stop`

```json
{
  "requestId": "string",
  "conversationId": "uuid"
}
```

#### `call.ring.ack`

```json
{
  "requestId": "string",
  "callId": "uuid"
}
```

#### `call.offer`

```json
{
  "requestId": "string",
  "callId": "uuid",
  "signalingVersion": 1,
  "sdp": "string"
}
```

#### `call.answer`

```json
{
  "requestId": "string",
  "callId": "uuid",
  "signalingVersion": 1,
  "sdp": "string"
}
```

#### `call.ice`

```json
{
  "requestId": "string",
  "callId": "uuid",
  "signalingVersion": 1,
  "candidate": {
    "candidate": "string",
    "sdpMid": "string|null",
    "sdpMLineIndex": 0,
    "usernameFragment": "string|null"
  }
}
```

### 2.3 Server to client events

#### `presence.updated`

```json
{
  "userId": "uuid",
  "status": "ONLINE|OFFLINE",
  "updatedAt": "timestamp"
}
```

#### `match.created`

```json
{
  "match": {}
}
```

#### `conversation.message.created`

```json
{
  "conversationId": "uuid",
  "message": {}
}
```

#### `conversation.message.updated`

```json
{
  "conversationId": "uuid",
  "message": {}
}
```

#### `conversation.message.deleted`

```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "sequence": 16,
  "status": "DELETED_BY_SENDER|REMOVED_BY_MODERATION",
  "deletedAt": "timestamp"
}
```

#### `conversation.read.updated`

```json
{
  "conversationId": "uuid",
  "readState": {}
}
```

#### `conversation.typing.updated`

```json
{
  "conversationId": "uuid",
  "userId": "uuid",
  "isTyping": true,
  "expiresAt": "timestamp"
}
```

#### `notification.created`

```json
{
  "notification": {}
}
```

#### `call.ringing`

```json
{
  "call": {},
  "otherUser": {},
  "iceServers": [
    {
      "urls": ["stun:example.org:3478"]
    }
  ]
}
```

#### `call.accepted`

```json
{
  "call": {}
}
```

#### `call.acceptedElsewhere`

```json
{
  "callId": "uuid",
  "acceptedBySessionId": "uuid",
  "occurredAt": "timestamp"
}
```

#### `call.connected`

```json
{
  "call": {}
}
```

#### `call.ended`

```json
{
  "call": {}
}
```

#### `call.missed`

```json
{
  "call": {}
}
```

#### `call.offer`

```json
{
  "callId": "uuid",
  "signalingVersion": 1,
  "fromUserId": "uuid",
  "sdp": "string"
}
```

#### `call.answer`

```json
{
  "callId": "uuid",
  "signalingVersion": 1,
  "fromUserId": "uuid",
  "sdp": "string"
}
```

#### `call.ice`

```json
{
  "callId": "uuid",
  "signalingVersion": 1,
  "fromUserId": "uuid",
  "candidate": {
    "candidate": "string",
    "sdpMid": "string|null",
    "sdpMLineIndex": 0,
    "usernameFragment": "string|null"
  }
}
```

#### `system.error`

```json
{
  "code": "STRING_CODE",
  "message": "Human readable message",
  "requestId": "uuid",
  "details": {}
}
```

## 3. Exact Error Code Map

### 3.1 Generic

| Code | HTTP | Meaning |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | DTO validation failed |
| `INVALID_CURSOR` | 400 | Cursor is malformed or expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `SESSION_INVALID` | 401 | Session is revoked, expired, or mismatched |
| `FORBIDDEN` | 403 | Action forbidden by policy |
| `RESOURCE_NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Generic write conflict |
| `IDEMPOTENCY_CONFLICT` | 409 | Duplicate key with conflicting payload |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 3.2 Auth and sessions

| Code | HTTP | Meaning |
|---|---:|---|
| `AUTH_IDENTIFIER_REQUIRED` | 400 | Signup requires email or phone |
| `AUTH_IDENTIFIER_TAKEN` | 409 | Email or phone already in use |
| `AUTH_PASSWORD_WEAK` | 400 | Password fails policy |
| `AUTH_INVALID_CREDENTIALS` | 401 | Login password mismatch or unknown identifier |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token invalid |
| `AUTH_REFRESH_REPLAY_DETECTED` | 401 | Refresh replay detected; session revoked |
| `AUTH_ACCOUNT_RESTRICTED` | 403 | Account status prevents login |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Account suspended |
| `AUTH_ACCOUNT_BANNED` | 403 | Account banned |
| `SESSION_NOT_FOUND` | 404 | Session not found |
| `SESSION_NOT_OWNED` | 403 | Session belongs to another user |
| `PUSH_TOKEN_INVALID` | 400 | Push token payload invalid |

### 3.3 Users and profiles

| Code | HTTP | Meaning |
|---|---:|---|
| `PROFILE_NOT_FOUND` | 404 | Profile not found |
| `PROFILE_LOCATION_REQUIRED` | 400 | Location is required for completion |
| `PROFILE_AGE_RESTRICTED` | 400 | User must be at least 18 |
| `PROFILE_COMPLETION_REQUIRED` | 403 | Action requires a complete profile |
| `PROFILE_PHOTO_INVALID_TYPE` | 400 | Unsupported photo MIME type |
| `PROFILE_PHOTO_TOO_LARGE` | 400 | Photo exceeds size limit |
| `PROFILE_PHOTO_NOT_FOUND` | 404 | Photo not found |
| `PROFILE_PHOTO_NOT_OWNED` | 403 | Photo belongs to another user |
| `PROFILE_PHOTO_PENDING_MODERATION` | 409 | Photo not usable until moderation resolves |
| `PROFILE_PHOTO_REJECTED` | 409 | Photo rejected by moderation |
| `PROFILE_PHOTO_PRIMARY_REQUIRED` | 409 | At least one approved primary photo required |
| `PROFILE_PHOTO_ORDER_INVALID` | 400 | Photo order payload invalid |

### 3.4 Interests and discovery

| Code | HTTP | Meaning |
|---|---:|---|
| `INTEREST_TAG_NOT_FOUND` | 404 | Interest tag does not exist |
| `INTENT_REQUIRED` | 400 | At least one intent is required |
| `DISCOVERY_NOT_AVAILABLE` | 403 | User cannot access discovery |
| `DISCOVERY_PROFILE_INCOMPLETE` | 403 | Discovery blocked until profile is complete |
| `DISCOVERY_ACCOUNT_RESTRICTED` | 403 | Discovery blocked by moderation or account status |

### 3.5 Likes, matches, blocks

| Code | HTTP | Meaning |
|---|---:|---|
| `LIKE_SELF_FORBIDDEN` | 400 | User cannot like themselves |
| `LIKE_TARGET_NOT_ELIGIBLE` | 409 | Target cannot currently be interacted with |
| `LIKE_BLOCKED` | 409 | Like blocked by active block |
| `LIKE_ALREADY_RETRACTED` | 409 | Like already retracted |
| `PASS_SELF_FORBIDDEN` | 400 | User cannot pass themselves |
| `MATCH_NOT_FOUND` | 404 | Match not found |
| `MATCH_NOT_ACTIVE` | 409 | Match is no longer active |
| `MATCH_COMMUNICATION_FORBIDDEN` | 403 | Communication mode not allowed for this match |
| `BLOCK_SELF_FORBIDDEN` | 400 | User cannot block themselves |
| `BLOCK_ALREADY_ACTIVE` | 200 | Existing active block returned idempotently |

### 3.6 Conversations and messages

| Code | HTTP | Meaning |
|---|---:|---|
| `CONVERSATION_NOT_FOUND` | 404 | Conversation not found |
| `CONVERSATION_NOT_ACCESSIBLE` | 403 | User is not a participant |
| `CONVERSATION_CLOSED` | 409 | Conversation no longer accepts activity |
| `MESSAGE_NOT_FOUND` | 404 | Message not found |
| `MESSAGE_NOT_OWNED` | 403 | Message belongs to another sender |
| `MESSAGE_TEXT_REQUIRED` | 400 | Text message body required |
| `MESSAGE_ATTACHMENT_REQUIRED` | 400 | Attachment payload required |
| `MESSAGE_ATTACHMENT_INVALID_TYPE` | 400 | Unsupported attachment MIME type |
| `MESSAGE_ATTACHMENT_TOO_LARGE` | 400 | Attachment exceeds size limit |
| `MESSAGE_ATTACHMENT_UPLOAD_INVALID` | 400 | Upload token or object key invalid |
| `MESSAGE_EDIT_WINDOW_EXPIRED` | 409 | Text message edit window expired |
| `MESSAGE_ALREADY_DELETED` | 409 | Message already deleted |
| `READ_SEQUENCE_INVALID` | 400 | Read sequence exceeds conversation max or regresses |

### 3.7 Calls

| Code | HTTP | Meaning |
|---|---:|---|
| `CALL_NOT_FOUND` | 404 | Call session not found |
| `CALL_NOT_RINGING` | 409 | Call is not in ringing state |
| `CALL_NOT_ACTIVE` | 409 | Call is terminal or unavailable |
| `CALL_PERMISSION_DENIED` | 403 | Call not allowed by current permissions |
| `CALL_CONFLICT_ACTIVE_EXISTS` | 409 | Conflicting active call already exists |
| `CALL_ALREADY_ACCEPTED` | 409 | Another device already accepted the call |
| `CALL_STALE_SIGNAL` | 409 | Signaling message is stale or version mismatch |
| `CALL_SIGNAL_INVALID` | 400 | Signal payload invalid |

### 3.8 Reports, moderation, admin

| Code | HTTP | Meaning |
|---|---:|---|
| `REPORT_INVALID_TARGET` | 400 | Report target context does not match payload |
| `REPORT_DUPLICATE` | 200 | Existing open report returned idempotently |
| `MODERATION_CASE_NOT_FOUND` | 404 | Moderation case not found |
| `MODERATION_ACTION_INVALID` | 400 | Action not allowed for target state |
| `ADMIN_ROLE_REQUIRED` | 403 | Admin or moderator role required |
| `FEATURE_FLAG_NOT_FOUND` | 404 | Feature flag not found |

### 3.9 WebSocket use

- WebSocket errors reuse the same `code` values.
- Transport status is carried by the ack `ok` flag or `system.error` event, not HTTP.

## 4. Exact Profile Completion Minimum Criteria

`UserProfile.isComplete = true` only when all criteria below are true at the same time:

1. `User.deletedAt IS NULL`
2. `User.status = ACTIVE`
3. `UserProfile.deletedAt IS NULL`
4. `UserProfile.isHidden = false`
5. `displayName` present and length `2..80`
6. `bio` present and length `20..1000`
7. `dateOfBirth` present and computed age `>= 18`
8. `city`, `region`, and `countryCode` all present
9. `locationLat`, `locationLng`, and `locationGeohash` all present
10. at least one active `UserIntent` exists
11. at least one `ProfilePhoto` exists with:
    - `moderationStatus = APPROVED`
    - `deletedAt IS NULL`
12. at least one approved active photo is marked `isPrimary = true`
13. `UserDiscoveryPreference` row exists and all are true:
    - `minAge` is not null
    - `maxAge` is not null
    - `maxDistanceKm` is not null
    - `minAge >= 18`
    - `maxAge >= minAge`
    - `maxDistanceKm >= 1`
14. `UserCommunicationPreference` row exists

Rules
- `gender`, `pronouns`, `headline`, `interests`, `lifestyle`, and `schedulePreference` are optional for completion.
- `isComplete` must be recomputed on every write affecting any criterion above.
- `completedAt` is set when the profile transitions from incomplete to complete.
- If a previously complete profile becomes incomplete later, `isComplete` flips back to `false`; `completedAt` remains as the timestamp of the last successful completion.
- Discovery eligibility is stricter than completion; moderation and trust controls can still suppress a complete profile.

The exact `missingCriteria` enum set is:
- `DISPLAY_NAME`
- `BIO`
- `DATE_OF_BIRTH`
- `AGE_18_PLUS`
- `CITY`
- `REGION`
- `COUNTRY_CODE`
- `LOCATION_COORDINATES`
- `LOCATION_GEOHASH`
- `INTENT`
- `APPROVED_PHOTO`
- `APPROVED_PRIMARY_PHOTO`
- `DISCOVERY_PREFERENCE`
- `COMMUNICATION_PREFERENCE`
- `PROFILE_HIDDEN`
- `ACCOUNT_NOT_ACTIVE`

## 5. Exact Auth Strategy Decision

Final decision
- `password-only for v1`

Why this is final
- It fits the approved schema with zero model changes.
- It avoids introducing premature `AuthIdentity` / provider-linking tables before the first backend cut exists.
- It keeps session rotation, audit logging, moderation, and device management simpler for the first production implementation.

Exact v1 auth contract
- Signup requires:
  - `password`
  - at least one of `email` or `phone`
- Login requires:
  - `identifier` where identifier is either email or phone
  - `password`
- Social login is out of scope for v1.
- No social provider ids, external subject ids, or identity-link tables are added in this phase.
- No schema changes are introduced by this decision.

Exact password policy
- minimum length: `10`
- maximum accepted length at API boundary: `72`
- must not be identical to email or phone
- no whitespace trimming is applied to password values
- empty or all-whitespace passwords are rejected

Exact identifier policy
- `email` is lowercased and trimmed before storage
- `phone` is normalized to E.164-like canonical form before storage
- `identifier` login input is normalized as email if it contains `@`, otherwise normalized as phone

Out of scope for v1
- social login
- passwordless login
- email verification
- phone OTP verification
- password reset flows

Future extension rule
- Social auth can be added later only in a separate schema phase with explicit new models; it must not be bolted into the password-only contract implicitly during code generation.
