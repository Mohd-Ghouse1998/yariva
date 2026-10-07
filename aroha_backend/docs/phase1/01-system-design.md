# 1. FINAL CORRECTED SYSTEM DESIGN

## 1.1 Context-Level Architecture

### Primary actors
- Mobile app: iOS/Android client using REST for durable state changes and WebSocket for realtime delivery.
- Aroha backend: NestJS modular monolith exposing authenticated REST APIs, WebSocket gateways, BullMQ workers, and admin-only moderation endpoints.
- Admin/moderation console: separate privileged client that talks to the same backend over admin REST APIs and optional admin WebSocket channels.
- PostgreSQL: source of truth for users, profiles, likes, matches, conversations, messages, reports, moderation, trust, feature flags, analytics, and audit trails.
- Redis: ephemeral state only; rate limits, presence, socket fanout, discovery snapshots, signaling caches, idempotency keys, and BullMQ backing store.
- S3-compatible storage: profile photos and chat attachments, always addressed by object key, never by user-supplied URL.
- Push providers: APNS/FCM through notification integrations.
- STUN/TURN infrastructure: used by clients for WebRTC media traversal; backend only creates signaling state and authorization context.

### Mobile app to backend interactions
- REST is used for signup, login, refresh, logout, device/session management, profile CRUD, photo upload initiation/finalization, discovery fetch, like/pass, conversation list/history, read updates, call initiation, block/report actions, and notification inbox state.
- WebSocket is used for presence heartbeats, new match delivery, message delivery, typing indicators, read receipt fanout, call signaling, missed live event recovery hints, and admin live moderation updates.
- The mobile client never talks directly to PostgreSQL or Redis.
- The mobile client uploads media to S3 only through short-lived backend-issued presigned upload instructions.

### Responsibility split
- REST responsibilities:
  - authenticated commands and queries over durable state
  - cursor-based pagination
  - idempotent command handling
  - upload authorization
  - moderation-safe public payload shaping
- WebSocket responsibilities:
  - authenticated realtime subscriptions
  - user/session socket registration
  - message/call event fanout
  - typing and presence heartbeats
  - cross-instance delivery via Redis pub/sub
- PostgreSQL responsibilities:
  - canonical identity, profile, discovery, match, chat, call metadata, moderation, trust, notification, analytics, and audit records
  - transactional writes for like->match, message sequencing, block effects, and session rotation
  - durable history and recovery
- Redis responsibilities:
  - no source-of-truth business data
  - transient fanout, caches, counters, heartbeats, idempotency markers, and queue transport
- BullMQ responsibilities:
  - asynchronous side effects and cleanup jobs
  - retries, dead-letter handling, observability
- S3 responsibilities:
  - immutable binary objects
  - object-key based ownership boundaries
  - private buckets with presigned access
- STUN/TURN assumptions:
  - TURN credentials are provisioned out-of-band or generated server-side for authenticated users
  - media never traverses the NestJS backend
  - backend validates call permissions before signaling, not media routing
- Admin/moderation responsibilities:
  - review reports, photos, trust anomalies, and suspicious users
  - execute actions with audit logging
  - freeze discovery/chat/calls or suspend/ban accounts

## 1.2 Container-Level Architecture

### Container 1: API application
- NestJS HTTP server and WebSocket gateway in the same process image.
- Stateless application instances behind a load balancer.
- Uses JWT auth, Prisma, Redis, S3 integration, BullMQ producers, and Redis pub/sub adapter for WebSocket fanout.
- Handles all synchronous business use cases.

### Container 2: Worker application
- Same monolith codebase, different bootstrap entrypoint.
- Runs BullMQ consumers for notifications, photo moderation, analytics rollups, trust recompute, stale call cleanup, pass cleanup, and session cleanup.
- May publish WebSocket fanout events through Redis when background jobs change live state.

### Container 3: PostgreSQL
- Primary database for all durable product state.
- Optional read replicas are allowed later, but all writes and correctness-sensitive reads stay on primary in v1.

### Container 4: Redis
- Shared across API and worker processes.
- Hosts BullMQ queues, ephemeral maps, rate limit counters, signaling relay buffers, and short-lived feed snapshots.

### Container 5: S3-compatible object storage
- Private buckets for `profile-photos/` and `message-attachments/`.
- Clients upload directly using presigned instructions issued by backend.

### External systems
- Push providers: APNS/FCM.
- STUN/TURN servers: coturn or managed equivalent.
- Optional automated media moderation provider can be called by `photo.moderation`; manual admin review remains first-class.

## 1.3 Component-Level Architecture

### Shared runtime components
- `PrismaService`: connection management and transaction entrypoint.
- `TransactionManager`: wraps Prisma interactive transactions with retry rules for serialization failures.
- `DomainEventPublisher`: buffers domain events during a transaction and emits them only after commit succeeds.
- `WsSessionRegistry`: Redis-backed user/session/socket mapping.
- `PresenceStore`: Redis-backed heartbeat registry.
- `ObjectStorageService`: issues presigned uploads/downloads and validates object ownership.
- `QueuePublisher`: typed BullMQ producer wrapper.
- `PolicyEngine`: reusable cross-module permission checks.

### Core business components
- Auth and Sessions: credentials, token issuance, refresh rotation, revoke/list device sessions.
- Users and Profiles: account metadata, public profile, photos, intents, interests, lifestyle, schedule, discovery prefs, communication prefs.
- Discovery: candidate eligibility, ranking, cursor snapshots, exclusion rules.
- Likes and Matches: like/pass lifecycle, mutual-like atomic match creation, match settings.
- Conversations and Messages: one conversation per match, message sequencing, read tracking, inbox projections.
- Calls and Presence: signaling metadata, ring/accept/decline/connect/end flows, online state.
- Blocks and Reports: hard safety barriers and abuse escalation.
- Moderation and Admin: case management, photo review, trust-based actions, admin auditability.
- Notifications, Analytics, Feature Flags: delivery, instrumentation, operational rollout control.

## 1.4 Data Ownership Boundaries

- `auth` owns credential verification and token issuance rules.
- `sessions` owns `UserSession` and `PushToken`.
- `users` owns the base `User` record and account state flags.
- `profiles` owns `UserProfile`, `ProfilePhoto`, `UserLifestyle`, `UserSchedulePreference`, `UserDiscoveryPreference`, and `UserCommunicationPreference`.
- `interests` owns `InterestTag`, `UserInterest`, and `UserIntent`.
- `discovery` owns no durable primary tables; it composes read models from profile, trust, block, pass, like, and match data.
- `likes` owns `Like` and `Pass`.
- `matches` owns `Match` and `MatchCommunicationSetting`.
- `conversations` owns `Conversation` and `ConversationRead`.
- `messages` owns `Message`.
- `calls` owns `CallSession` and Redis signaling buffers.
- `blocks` owns `Block`.
- `reports` owns `Report`.
- `moderation` owns `ModerationCase` and moderation action orchestration.
- `notifications` owns `Notification`.
- `analytics` owns `AnalyticsEvent`.
- `feature-flags` owns `FeatureFlag`.
- `admin` owns no base tables; it orchestrates privileged actions across modules and always emits `AuditLog`.
- `common/audit` owns `AuditLog`.

## 1.5 Request Lifecycle Design

1. Client sends REST request with access token or connects WebSocket with token + session id.
2. Nest global guards validate JWT, session state, role, and rate limits.
3. DTO validation runs with whitelist and forbidden unknown fields.
4. Controller/gateway only maps transport data to application input.
5. Application service loads current user/session context and enters transaction if the use case writes critical data.
6. Domain services enforce invariants, ownership, and permission checks.
7. Repositories perform persistence only.
8. Application service assembles response DTO and buffers domain events.
9. Transaction commits.
10. After commit, event publisher emits:
    - in-process events for module reactions
    - Redis pub/sub fanout for WebSocket delivery
    - BullMQ jobs for async side effects
11. Client receives HTTP response immediately; realtime subscribers receive fanout separately.

## 1.6 Sequence Flows

### Signup / Login

#### Signup
1. Client posts `POST /auth/signup` with email or phone, password, device metadata.
2. Auth service validates that at least one of email/phone exists and is normalized.
3. Within transaction, backend creates `User`, empty `UserProfile`, defaults for communication/discovery preferences, `TrustScore`, and `UserSession`.
4. Refresh token hash and JTI are stored on `UserSession`.
5. `user.registered` and `session.created` events are buffered.
6. Transaction commits.
7. Access token and refresh token are returned.
8. After commit, analytics and welcome notification events are emitted.

#### Login
1. Client posts `POST /auth/login` with identifier + password + device metadata.
2. Auth service finds active user, verifies password hash, rejects suspended/banned/deleted accounts.
3. Existing session for same device may be rotated or a new `UserSession` created based on device id policy.
4. New refresh token hash/JTI is written transactionally.
5. Response returns tokens plus current account state.

### Profile Completion
1. Client updates profile sections over REST.
2. Profiles application service validates fields, photo ownership, and moderation-safe constraints.
3. When photos are uploaded, `ProfilePhoto` rows start in `PENDING`.
4. On every profile mutation, profile completeness is recomputed.
5. `isComplete` becomes true only when required fields exist and at least one approved photo exists.
6. `profile.completed` is emitted when crossing from incomplete to complete.
7. Discovery cache for the user is invalidated after commit.

### Discovery Feed Request
1. Client calls `GET /discovery/feed?cursor=...`.
2. Discovery service verifies viewer account is allowed to discover.
3. Redis is checked for an unexpired feed snapshot keyed by `viewerId + preferenceVersion`.
4. If cache miss, discovery query builds candidate pool from PostgreSQL with hard exclusions:
   - self
   - blocked in either direction
   - already matched
   - users already actively liked
   - currently passed users inside pass TTL
   - hidden or incomplete profiles
   - users with no approved photos
   - suspended/banned/restricted users
   - users hidden by shadow-ban
5. Candidate pool is ranked using deterministic scoring, diversity reordering is applied, and a snapshot list is cached in Redis.
6. API returns cursor page from snapshot plus privacy-safe candidate payloads.

### Like To Match Transaction
1. Client posts `POST /likes` with target id and optional idempotency key.
2. Service validates actor != target and actor/target are both interaction-eligible.
3. Active blocks in either direction are checked.
4. In a serializable transaction:
   - upsert actor->target like row to `ACTIVE`
   - load reciprocal like `target->actor`
   - if reciprocal like is active, create canonical `Match` if absent
   - create `Conversation` if absent
   - create two `MatchCommunicationSetting` rows if absent
   - mark both likes as `MATCHED`
5. Transaction commits exactly one durable match pair.
6. After commit:
   - `like.created` or `match.created` is emitted
   - notification jobs are queued
   - WebSocket match event is published to both users

### Sending a Chat Message
1. Client posts `POST /conversations/:id/messages` with `clientMessageId`.
2. Service verifies caller is a participant, match is active, and no active block exists.
3. For attachment messages, object ownership and moderation prerequisites are verified.
4. In transaction:
   - lock conversation row by updating `lastMessageSequence += 1`
   - create `Message(sequence=n)`
   - update conversation preview fields
5. Commit succeeds.
6. After commit:
   - `message.sent` event fans out over WebSocket
   - notification job is enqueued for offline recipient

### Initiating And Accepting A Call
1. Caller posts `POST /calls` with `matchId` and mode (`VOICE` or `VIDEO`).
2. Service rechecks:
   - active match
   - no block
   - caller global pref allows mode
   - receiver global pref allows mode
   - both per-match settings allow mode
   - no conflicting active call for that match
3. `CallSession(status=RINGING, expiresAt=now+30s)` is created.
4. Offer SDP is stored only in Redis ephemeral signaling store.
5. Ring event is broadcast to all receiver sockets; push notification is sent if needed.
6. A receiver session sends `call.accept`.
7. In transaction, backend updates call from `RINGING` to `ACCEPTED` only if still open; first accept wins.
8. Answer SDP and subsequent ICE are relayed through WebSocket/Redis, never persisted in PostgreSQL.
9. On connected acknowledgement, state becomes `CONNECTED`.
10. End, timeout, block, unmatch, or permission loss moves state to terminal and triggers cleanup fanout.

### Blocking During An Active Conversation
1. User posts `POST /blocks`.
2. Service upserts active `Block`.
3. In one transaction:
   - active match is ended with reason `BLOCKED`
   - conversation status becomes `BLOCKED`
   - active call sessions for the match are ended with reason `BLOCKED`
4. Commit succeeds.
5. After commit:
   - discovery cache invalidation is published for both users
   - both users are removed from each other’s live conversation/call channels
   - any future message/call attempts fail

### Reporting A User
1. User posts `POST /reports` with target context and reason.
2. Service validates report target belongs to the reported user or related match/conversation.
3. Deduplication key is computed from reporter, reported, target type/id, reason, and a cooldown window.
4. In transaction:
   - report is inserted or existing open duplicate is returned
   - moderation case is created or linked according to severity rules
5. Commit succeeds.
6. After commit:
   - trust score recompute is queued
   - moderators receive case availability events

## 1.7 Discovery Design

### Profile discoverability gate
A user is discoverable only when all are true:
- `User.status = ACTIVE`
- `User.deletedAt IS NULL`
- `User.isShadowBanned = false`
- `User.isDiscoveryFrozen = false`
- `UserProfile.isHidden = false`
- `UserProfile.isComplete = true`
- at least one `ProfilePhoto` exists with `moderationStatus = APPROVED` and `deletedAt IS NULL`
- no active moderation action freezes discovery

### Candidate eligibility rules
- Candidate must pass the same discoverability gate.
- Candidate must not have blocked viewer.
- Viewer must not have blocked candidate.
- Candidate must not already have an active match with viewer.
- Candidate must not be under active pass TTL from viewer.
- Candidate must not already have an active outgoing like from viewer.

### Hard filters
- age inside viewer range
- distance inside viewer max distance
- at least one overlapping intent between viewer selected intents and candidate intents
- optional gender preference filter if configured
- only profiles with approved photos

### Exclusion rules
- self
- soft-deleted accounts
- hidden profiles
- incomplete profiles
- moderation-restricted users
- blocked users in either direction
- already matched users
- users currently passed within TTL
- users already liked and waiting

### Soft ranking factors
Deterministic v1 score out of 100:
- `intentScore = 30 * overlapRatio(selectedIntents, candidateIntents)`
- `interestScore = 20 * jaccard(userInterests, candidateInterests)`
- `lifestyleScore = 15 * normalizedLifestyleCompatibility`
- `scheduleScore = 10 * normalizedScheduleOverlap`
- `distanceScore = 10 * distanceBandScore`
- `freshnessScore = 10 * recentActivityScore`
- `trustScore = 5 * normalizedTrustScore`

Formula:
`totalScore = intentScore + interestScore + lifestyleScore + scheduleScore + distanceScore + freshnessScore + trustScore - trustPenalty - repeatPenalty`

Where:
- `distanceBandScore` = `1.0` within 10 km, `0.8` within 25 km, `0.6` within 50 km, `0.4` within viewer max distance
- `recentActivityScore` = `1.0` active in 24h, `0.7` active in 72h, `0.4` active in 7d, else `0.1`
- `trustPenalty` = `0` for trust >= 70, `2` for 50-69, `5` for 30-49, `10` for <30
- `repeatPenalty` = `5` if same city+intent bucket has already been served twice consecutively in the snapshot

### Diversity rules
- No more than 2 consecutive candidates from the same primary intent bucket.
- No more than 3 consecutive candidates from the same city/region bucket when alternative eligible candidates exist.
- If two candidates tie, sort by higher trust, then more recent activity, then lower UUID lexical order for deterministic pagination.

### Feed freshness rules
- Snapshot TTL: 120 seconds.
- Candidate already shown in current snapshot is not repeated in that snapshot.
- Profiles served in the previous 24 hours are deprioritized unless pool size is low.
- Any state change affecting eligibility invalidates the viewer snapshot.

### Pass TTL rules
- Default pass TTL: 14 days.
- Re-passing refreshes the same row and pushes `expiresAt` forward.
- Expired passes become eligible again automatically.

### Empty feed fallback rules
- Step 1: widen distance to `min(2 * maxDistanceKm, 250)`.
- Step 2: include candidates active in last 30 days instead of 7 days.
- Step 3: reuse expired pass profiles older than 30 days.
- Step 4: return empty set with retry hint if still no candidates.
- Block, moderation, hidden, incomplete, and match exclusions are never relaxed.

### Cache strategy
- Redis key: `discovery:snapshot:{viewerId}:{preferenceHash}`.
- Value: ordered candidate id list + score metadata + served bucket counters.
- Invalidated by profile, photo moderation, like, pass, match, block, trust, and moderation state changes.

### Pagination strategy
- Cursor encodes `snapshotId` and `nextIndex`.
- Cursor is opaque, signed, and expires with the snapshot TTL.
- No offset/page-number endpoints exist.

### Location privacy-safe relevance logic
- Backend stores exact coordinates or precise geohash for ranking.
- Public payload exposes only `city`, `region`, `countryCode`, and rounded distance band.
- No latitude/longitude, exact distance, or exact geohash is returned to another user.

## 1.8 Match Creation Design

### Exact atomic flow
1. Validate actor authenticated, active, and not liking self.
2. Validate target exists and is eligible for interaction.
3. Check active blocks in either direction.
4. Resolve any existing actor->target like:
   - `ACTIVE`: idempotent success, no duplicate insert
   - `RETRACTED`: reactivate same row
   - `MATCHED`: return existing match if present
5. Start serializable transaction.
6. Upsert actor->target like to `ACTIVE`.
7. Read reciprocal like.
8. If reciprocal like is active:
   - compute canonical pair `(userLowId, userHighId)`
   - create `Match` if absent
   - create `Conversation` if absent
   - create both `MatchCommunicationSetting` rows if absent
   - update both likes to `MATCHED`
9. Commit.
10. Emit after-commit events only.

### Duplicate prevention
- `Like`: unique `(actorId, targetId)`
- `Match`: unique `(userLowId, userHighId)`
- `Conversation`: unique `(matchId)`
- `MatchCommunicationSetting`: unique `(matchId, userId)`

### Idempotency strategy
- Optional request header `Idempotency-Key`.
- Stored in Redis under `idem:{userId}:like:{key}` for 24 hours.
- Cached response stores resulting like/match id.
- DB uniqueness is the ultimate backstop if Redis entry is missing.

### Race-condition handling
- Serializable transaction with retry on serialization failure.
- If concurrent mutual likes both attempt to create match, one wins on unique pair; loser reads existing match and completes idempotently.
- Conversation and settings creation use `create if absent` semantics under the same transaction.

## 1.9 Chat Design

### Conversation creation rules
- Conversation is created only when a match is created.
- Exactly one conversation exists per match.
- No ad-hoc conversation creation endpoint exists.

### Conversation fetch rules
- Only match participants can fetch.
- Active conversations are fully readable.
- After unmatch or block, history remains durable but no new sends are allowed.
- After block, blocker may still access history; blocked user receives closed conversation metadata and history through REST but no live subscription or new send permission.

### Message model behavior
- Every message gets a monotonically increasing `sequence` scoped to conversation.
- Ordering in APIs and WebSocket payloads uses `(conversationId, sequence)`.
- `clientMessageId` provides sender-side idempotency.
- Last message preview is stored on `Conversation`.

### Read receipts
- `ConversationRead.lastReadSequence` is updated by participant.
- Receipt fanout is WebSocket-only and emitted after commit.
- Unread count is derived from `Conversation.lastMessageSequence - ConversationRead.lastReadSequence`.

### Typing indicators
- Redis-only ephemeral state with 6-second TTL.
- Not persisted to PostgreSQL.
- Disabled immediately when conversation becomes blocked or closed.

### Edit / delete policy
- Sender may edit text messages for 15 minutes if message is not deleted and conversation remains active.
- Media attachments are not editable.
- Sender may soft-delete own message at any time; body/attachment preview is tombstoned, row remains for sequencing/audit.
- Moderation-removed messages become tombstones visible to both users.

### Soft-delete / tombstone behavior
- `deletedAt` and `status` mark deletion.
- `sequence`, `senderId`, `createdAt`, and moderation metadata remain.
- Conversation preview recalculates to most recent non-tombstoned visible message or a system placeholder.

### Attachment support
- One attachment per message in v1.
- Upload is presigned to S3, then message is finalized via REST.
- Supported content types:
  - images: `image/jpeg`, `image/png`, `image/webp`
  - videos: `video/mp4`, `video/quicktime`
  - audio: `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/wav`

### Media moderation hook points
- Attachment messages can start as `PENDING_MODERATION`.
- Sender sees pending state immediately.
- Recipient receives media only after approval, or a tombstone if rejected.

### Reject behavior after block / unmatch
- Any send, edit, typing, read update, or attachment finalize after block/unmatch returns conflict/forbidden.
- Pending attachment uploads are left in storage temporarily and cleaned by retention jobs if never finalized.

## 1.10 Call Signaling Design

### Effective permission logic
A call is allowed only when all are true:
- match is active
- no active block exists
- caller and receiver are both active users
- caller global communication preference allows mode
- receiver global communication preference allows mode
- caller per-match setting allows mode
- receiver per-match setting allows mode
- neither user is under call freeze moderation

### Call session state machine
- `INITIATED` -> transient request validation only
- `RINGING`
- `ACCEPTED`
- `CONNECTING`
- `CONNECTED`
- terminal states: `DECLINED`, `CANCELED`, `MISSED`, `ENDED`, `TIMED_OUT`, `FAILED`

### Initiate / ring / accept / decline / connect / end / timeout
- Initiate: create durable `CallSession(RINGING)`, store offer in Redis, fan out ring.
- Accept: first receiver session that atomically flips state from `RINGING` to `ACCEPTED` wins.
- Decline: receiver moves state to `DECLINED` if still ringing.
- Connect: either side can send connected acknowledgement; backend marks `CONNECTED` once accepted signaling completes.
- End: either side can end `ACCEPTED`, `CONNECTING`, or `CONNECTED`.
- Timeout: worker marks unanswered ringing calls `MISSED`/`TIMED_OUT` after expiry.

### First accept wins logic
- `UPDATE ... WHERE status = RINGING` semantics in one transaction.
- Later accepts receive stale-state rejection and a `call.no-longer-available` event.

### Multi-device ringing behavior
- All active receiver sessions/sockets ring simultaneously.
- Push notification is sent if no foreground socket ack is observed quickly.
- Once accepted on one session, all other receiver sessions receive `call.accepted-elsewhere`.

### Stale signaling protection
- Each signal message carries `callId`, `sessionId`, and `signalingVersion`.
- Offer/answer/ICE are rejected if call is terminal, blocked, unmatched, or version mismatch occurs.

### Reconnect behavior
- If WebSocket disconnects while call is `CONNECTED`, backend keeps call alive.
- Rejoining sockets can re-subscribe to `call:{id}` until call ends.
- If both participants disconnect and no reconnect occurs within configurable timeout, cleanup job ends call as `FAILED`.

### Offline receiver behavior
- Call still creates durable `CallSession`.
- Push is sent immediately.
- If receiver never accepts before expiry, session becomes `MISSED`.

### Missed-call notification behavior
- Fired only when call reached `RINGING` and expired unanswered.
- Not fired for caller-canceled calls before ring delivery.

### ICE candidate handling strategy
- ICE candidates are stored only in Redis lists/streams with short TTL and immediately relayed.
- PostgreSQL stores no SDP or ICE blobs.

### Exact points where permissions are rechecked
- call initiation
- call accept
- every offer/answer relay
- every ICE relay
- connect acknowledgement
- any renegotiation
- before transitioning to `CONNECTED`
- on block/unmatch/moderation events, active calls are force-ended

### Cleanup jobs
- `call.cleanup.stale` transitions stale `RINGING`, `ACCEPTED`, and `CONNECTING` sessions to terminal states and evicts Redis signaling buffers.

## 1.11 Safety, Trust, And Moderation Design

### Block logic
- A block is directional and durable until explicitly removed.
- Creating a block immediately:
  - excludes both users from each other’s discovery
  - ends active match with reason `BLOCKED`
  - closes conversation for new activity
  - force-ends active calls

### Unblock logic
- Unblock is allowed for the blocker unless account-level moderation forbids it.
- Unblocking clears the active block record but does not restore the prior match or conversation to active status.
- Future rediscovery is allowed again only if both users become otherwise eligible.

### Report logic
- Reports can target a user, message, photo, conversation, or call session.
- Reports are immutable after creation.
- High-severity reasons trigger immediate moderation case creation.

### Report deduplication rules
- One open report per reporter + target context + reason + cooldown bucket.
- Duplicates return the existing report id instead of creating another row.

### Moderation case creation logic
- A new case is created when:
  - high-severity report is filed
  - photo moderation rejects severe content
  - trust score crosses critical threshold
  - spam/fraud heuristics trip
- Otherwise a report may attach to an existing open case for the same subject user.

### Trust score formula
- Base score: `70`
- Positive adjustments:
  - completed profile with approved photo: `+5`
  - account age > 30 days: `+5`
  - healthy session stability: `+5`
- Negative adjustments:
  - each confirmed high-severity report: `-20`
  - each confirmed medium-severity report: `-10`
  - high unique block rate in 30d: up to `-20`
  - spam-like rate anomaly: `-15`
  - message moderation rejection: `-10`
  - photo moderation rejection: `-10`
  - device/account farm signal: `-15`
- Clamp to `0..100`
- Levels:
  - `HIGH >= 70`
  - `MEDIUM 40..69`
  - `LOW < 40`

### Trust recomputation triggers
- signup
- profile completion
- report creation or resolution
- block spikes
- moderation action
- photo moderation outcome
- abuse heuristic hit
- daily analytics rollup

### Spam/fraud heuristics
- excessive likes per minute/hour
- repeated identical message bodies across many matches
- high report-to-message ratio
- many accounts per device fingerprint
- rapid session churn across IPs
- high photo rejection rate

### Suspicious account controls
- freeze discovery
- disable calls
- rate-limit likes/messages more aggressively
- force manual moderation review
- apply shadow-ban

### Shadow-ban behavior
- User can still log in and browse.
- User is excluded from discovery.
- Outgoing likes do not create discoverable exposure for other users unless a match already exists.
- Existing matches remain readable unless separately frozen.

### Suspend / ban behavior
- Suspend:
  - revoke all sessions
  - hide profile from discovery
  - prevent new likes/messages/calls
- Ban:
  - same as suspend, plus permanent account disablement and admin-only restore path

### Profile photo moderation workflow
1. Upload starts with `PENDING`.
2. `photo.moderation` job runs automated review and/or queues manual admin review.
3. Approved photos become eligible for public payloads and discovery.
4. Rejected photos remain invisible to others and may open a moderation case.

### Admin moderation action matrix
- `NOTE_ONLY`
- `WARN`
- `REMOVE_PHOTO`
- `HIDE_PROFILE`
- `FREEZE_DISCOVERY`
- `FREEZE_CHAT`
- `FREEZE_CALLS`
- `SHADOW_BAN`
- `SUSPEND`
- `BAN`
- `RESTORE`

### Explicit outcome rules
- Discovery visibility after block: both sides excluded immediately.
- Existing matches after block: ended and never auto-restored.
- Conversations after block: preserved for history, closed for activity.
- Calls after block: force-ended immediately.
- Messages after report: remain unless auto-hidden or moderator removes them.
- Photos under moderation: never shown in discovery while pending or rejected.

### Audit logging rules
- Required for:
  - auth login/logout/refresh failure replay detection
  - session revocation
  - admin actions
  - moderation actions
  - block/unblock
  - report creation
  - feature flag changes
- Logs are append-only.

## 1.12 Redis Design

### Rate limiting
- Keys:
  - `ratelimit:auth:login:{ip}`
  - `ratelimit:auth:refresh:{sessionId}`
  - `ratelimit:likes:{userId}`
  - `ratelimit:messages:{userId}`
  - `ratelimit:calls:{userId}`
- Policy: token bucket or sliding window with TTL.

### Presence
- `presence:user:{userId}` -> last heartbeat, device count, status; TTL 60 seconds.
- Heartbeat interval: 20 seconds.

### Socket maps
- `sockets:user:{userId}` -> set of socket ids
- `sockets:session:{sessionId}` -> set of socket ids
- `socket:{socketId}` -> metadata hash with user/session/device info

### Pub/Sub
- Channels:
  - `ws:user:{userId}`
  - `ws:conversation:{conversationId}`
  - `ws:call:{callId}`
  - `admin:moderation`

### Short-lived discovery cache
- Feed snapshots with TTL 120 seconds.

### Idempotency key storage
- Keys: `idem:{userId}:{route}:{key}`.
- TTL: 24 hours.

### Ephemeral signaling state
- `call:offer:{callId}`
- `call:answer:{callId}`
- `call:ice:{callId}:{userId}`
- TTL: 120 seconds after terminal call state.

### Queue backend
- BullMQ queues share the same Redis deployment but separate queue prefixes.

## 1.13 BullMQ Queues And Jobs

### `notification.dispatch`
- Producer: auth, matches, messages, calls, moderation.
- Consumer: notifications worker.
- Payload:
  - `notificationId`
  - `userId`
  - `channel`
  - `type`
- Retry: exponential backoff, 5 attempts.
- Failure handling: mark notification `FAILED`, store provider error, surface to monitoring.
- Monitoring: queue latency, provider response codes, dead letters.

### `photo.moderation`
- Producer: profiles/photo finalization.
- Consumer: moderation worker.
- Payload:
  - `photoId`
  - `userId`
  - `objectKey`
  - `mimeType`
- Retry: 3 attempts with increasing backoff.
- Failure handling: leave photo `PENDING`, raise moderation alert after exhaustion.
- Monitoring: pending age, approval/rejection rates, provider failures.

### `analytics.rollup`
- Producer: analytics ingest and scheduled cron.
- Consumer: analytics worker.
- Payload:
  - `windowStart`
  - `windowEnd`
  - `metricSet`
- Retry: 3 attempts.
- Failure handling: rerunnable; never mutates source events.
- Monitoring: lag, row throughput, window completeness.

### `trustscore.recompute`
- Producer: reports, moderation, analytics, profile/photo events.
- Consumer: trust worker.
- Payload:
  - `userId`
  - `trigger`
  - `sourceId`
- Retry: 5 attempts.
- Failure handling: leave last score intact, emit alert if stale beyond SLO.
- Monitoring: recompute backlog, stale scores, trigger distribution.

### `call.cleanup.stale`
- Producer: calls module on call creation and scheduler.
- Consumer: calls worker.
- Payload:
  - `callSessionId`
  - `expectedStatus`
  - `expiresAt`
- Retry: 5 attempts.
- Failure handling: safe to rerun; terminal-state checks keep it idempotent.
- Monitoring: stale ring counts, timeout rate.

### `passes.cleanup.expired`
- Producer: scheduler only.
- Consumer: likes/discovery worker.
- Payload:
  - `batchCursor`
  - `limit`
- Retry: 3 attempts.
- Failure handling: rerun next cycle.
- Monitoring: expired active pass count.

### `sessions.cleanup.inactive`
- Producer: scheduler only.
- Consumer: sessions worker.
- Payload:
  - `inactiveBefore`
  - `batchCursor`
- Retry: 3 attempts.
- Failure handling: rerun next cycle.
- Monitoring: revoked inactive sessions, refresh expiry lag.

## 1.14 Security Design

### JWT access token design
- Short-lived JWT, default TTL 15 minutes.
- Claims:
  - `sub` user id
  - `sid` session id
  - `role`
  - `status`
  - `jti`
  - `iat`
  - `exp`
- No email, phone, or profile PII in token.
- Signed with rotating server-managed keys.

### Refresh token rotation design
- Refresh token is opaque high-entropy random secret, not a bearer JWT.
- DB stores hashed current token and current JTI on `UserSession`.
- On refresh:
  - verify current hash
  - rotate to new hash/JTI
  - keep previous hash/JTI for 30-second grace window
  - if old token is reused outside grace, revoke the session

### Refresh token storage strategy
- Hash refresh tokens with server-side pepper.
- Never store plaintext refresh tokens.

### Session revoke logic
- Revoke current session, selected session, or all other sessions.
- Revocation clears refresh token hashes, marks `revokedAt`, drops Redis socket mappings, and blocks future refresh.

### Device management
- Each login creates or rotates a `UserSession` bound to device metadata.
- Users can list active sessions/devices and revoke them individually.

### DTO validation
- Global `ValidationPipe` with whitelist and forbidNonWhitelisted.
- Explicit DTO classes per transport boundary.
- Enum and UUID validation on all externally supplied ids.

### RBAC for admin
- Roles:
  - `USER`
  - `MODERATOR`
  - `ADMIN`
- Admin routes require role guard plus action-level policies.

### Guards and policies
- JWT auth guard
- session guard
- rate limit guard
- admin role guard
- resource ownership policies
- match participation policies
- conversation participant policies

### Ownership checks / IDOR protection
- All reads/writes on user-scoped resources verify the authenticated user owns the resource or participates in its parent aggregate.
- Raw ids are never trusted without parent membership checks.

### Secure file upload strategy
- Backend issues presigned upload instructions only after validating file metadata.
- Object keys are namespaced by authenticated user and resource type.
- Finalization endpoint verifies:
  - object key prefix
  - expected size
  - allowed MIME type
  - checksum when supplied

### Allowed content types
- profile photos: `image/jpeg`, `image/png`, `image/webp`
- chat images: `image/jpeg`, `image/png`, `image/webp`
- chat video: `video/mp4`, `video/quicktime`
- chat audio: `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/wav`

### Upload size limits
- profile photo: 10 MB
- chat image: 15 MB
- chat video: 50 MB
- chat audio: 15 MB

### Privacy-safe public payload design
- expose:
  - user id
  - display name
  - age in years
  - bio/headline
  - intents
  - interests
  - lifestyle summary
  - approved photo URLs only
  - city/region/country
  - rounded distance band if allowed
- never expose:
  - email
  - phone
  - exact birth date
  - exact coordinates
  - moderation/trust internal state
  - session identifiers

### Rate limit policy
- login: 5/min per IP, 20/day per device fingerprint
- refresh: 10/min per session
- discovery: 60/min per user
- likes/passes: 60/hour per user
- messages: 60/min per user and 30/min per conversation
- call initiate: 10/hour per user, 3 simultaneous open rings max
- reports: 10/day per user

## 1.15 Deployment Topology

- API instances:
  - minimum 2 replicas behind L7 load balancer
  - sticky sessions not required
- Worker instances:
  - independently scalable by queue pressure
- PostgreSQL:
  - managed primary with daily backups and PITR
- Redis:
  - persistent or managed deployment suitable for BullMQ durability
- S3-compatible storage:
  - private buckets, lifecycle rules for abandoned uploads
- STUN/TURN:
  - geographically reachable TURN with auth secret rotation
- Secret management:
  - JWT keys, DB creds, Redis creds, S3 creds, TURN secret in secure secret store
- Observability:
  - structured logs, trace ids, queue metrics, DB/Redis dashboards, audit review

## 1.16 Internal Event Flow

### Synchronous domain events
- `user.registered`
- `session.created`
- `profile.completed`
- `photo.uploaded`
- `photo.moderation.completed`
- `like.created`
- `match.created`
- `match.ended`
- `message.sent`
- `message.read`
- `call.initiated`
- `call.accepted`
- `call.ended`
- `block.created`
- `block.removed`
- `report.created`
- `moderation.case.created`
- `trustscore.recomputed`
- `notification.created`

### Event routing
- After commit only.
- In-process listeners handle local cache invalidation and projection updates.
- Redis pub/sub fans out realtime events to WebSocket gateways across instances.
- BullMQ handles async notifications, moderation, analytics, trust, and cleanup work.
