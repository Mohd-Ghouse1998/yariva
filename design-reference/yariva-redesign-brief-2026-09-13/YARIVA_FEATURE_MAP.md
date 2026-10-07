# Yariva product and backend feature map

Prepared from the local source on 13 September 2026 for a new Figma design.

## Scope and evidence

Workspace: `/Users/mohdghouse/Documents/Aroha`.

Primary evidence: current `aroha_backend/src`, `aroha_backend/prisma/schema.prisma`, `frontend-mobile/src`, `frontend-mobile/app`, and `frontend-mobile/DESIGN.md`.

This is a static product-capability review, not a production audit or an end-to-end test. A controller/service means an implementation exists in the repository; it does not establish that it is deployed, configured, or working in production. No application code was changed for this handoff.

There are **20 backend feature modules, 78 REST route declarations, and 37 mobile route files excluding layout files**. Route files include redirect/entry screens and are not a count of distinct Figma screens. Variants, sheets, permissions, and errors increase the design scope.

The public brand is Yariva. Aroha remains in directory names, package metadata, native identifiers, legacy design exports, and older documentation. The existing app configuration already uses Yariva as its display name. Branding in a design must follow the user's requested name, not internal identifiers.

Do not use the old README as the final capability authority: it says a public profile endpoint is missing, but current source implements `GET /profiles/:userId` and the frontend exposes `profilesApi.publicById`.

## Product definition and primary sections

Existing product guidance describes an India-first dating app. Its core progression is profile → curated discovery → mutual match → conversation → mutually accepted public date → private meet-again response. The backend also retains friendship, companionship, shared interests, and relationship intent values alongside the newer dating intentions.

| Destination | Responsibility | Current mobile feature source |
| --- | --- | --- |
| Discover | Curated profiles, filters, full profile, private interest/introduction, pass and undo | `src/features/discovery/` |
| Connections | Incoming likes and mutual matches, including matches without a conversation history | `src/features/connections/`, `src/features/matches/` |
| Plans | Pending, accepted/upcoming, past date plans; proposal and response journey | `src/features/datePlans/` |
| Chats | Direct conversations and access to calls/date planning | `src/features/chat/`, `src/features/calls/` |
| Profile | My profile, edit sections, settings, privacy, communication, devices, blocked users | `src/features/profile/`, `src/features/settings/` |
| Notifications | In-app activity and contextual deep links | `src/features/notifications/` |
| Authentication/setup | Sign-up/login, session routing, required and optional profile sections | `src/features/auth/`, `src/features/profileSetup/`, `src/auth/` |
| Safety/system | Reporting, blocking, restricted accounts, loading and error states | `src/features/safety/`, `src/features/errors/` |

All sources in this table are relative to `frontend-mobile/`.

## Feature-by-feature inventory

Sources in the following table are relative to `aroha_backend/src/modules/`, unless another root is given.

| Module | Implemented capability | Design implications and boundaries | Principal evidence |
| --- | --- | --- | --- |
| Auth | Signup with email and/or phone/password, identifier/password login, refresh, logout, device/session metadata | Password authentication; no OTP/social login/recovery flow found | `auth/controllers/auth.controller.ts`, `auth/dto/auth.dto.ts`, `auth/domain/auth.domain.ts` |
| Users | Current account, status/role, account flags and profile completion | Route to correct setup/account state; hide internal enforcement flags from consumer presentation | `users/controllers/users.controller.ts`, `users/application/users.services.ts` |
| Sessions | List devices, revoke one, revoke all other sessions, register/invalidate APNS/FCM tokens | Current device, platform and last-active rows; logout/session-expiry states; token support is not push delivery | `sessions/controllers/`, `sessions/dto/sessions.dto.ts` |
| Profiles | Read/update own profile; authorized public profile; lifestyle, schedule, discovery and communication preferences | Edit/preview profile and grouped preference forms; public/private field separation | `profiles/controllers/profiles.controller.ts`, `profiles/dto/profiles.dto.ts`, `profiles/application/profiles.services.ts` |
| Photos within Profiles | Presigned upload/finalize, reorder, approved-primary selection, delete, moderation status | Uploading/pending/rejected/approved variants and completion gating | `profiles/controllers/profile-photos.controller.ts`, `profiles/domain/profiles.domain.ts` |
| Interests | Catalog, update user's interest IDs, update intentions | Categorized multi-select; exact supported intent values | `interests/controllers/`, `interests/dto/interests.dto.ts` |
| Discovery | Cached curated feed, eligibility/ranking/diversity, exclusions, public profile mapping, approximate distance, compatibility | Finite browsing, preference-aware cards, explainable reasons; up to eight per snapshot | `discovery/application/discovery.services.ts`, `discovery/domain/discovery.domain.ts`, `discovery/infrastructure/discovery.infrastructure.ts` |
| Likes | Incoming likes, create/retract like, create/retract expiring pass, optional intro note, reciprocal matching | Private note up to 300 characters; interest confirmation, Undo pass, incoming-interest and match states | `likes/controllers/likes.controller.ts`, `likes/dto/likes.dto.ts`, `likes/application/likes.services.ts` |
| Matches | List/detail/end match; per-person voice/video and mute settings | Match detail and communication settings; unmatch closes related conversation and cancels live plans | `matches/controllers/matches.controller.ts`, `matches/application/matches.services.ts` |
| Conversations | List/detail/history, read position, unread count, closure states | Inbox, first conversation, unread/read behavior, closed composer | `conversations/controllers/conversations.controller.ts`, `conversations/dto/conversations.dto.ts` |
| Messages | Send text, media upload/finalize, reply reference, edit text within 15 minutes, sender delete, moderation-aware payload | Text/image UI exists; fuller media and message-action UX requires client work | `messages/controllers/messages.controller.ts`, `messages/domain/messages.domain.ts`, `messages/dto/messages.dto.ts` |
| Presence | Socket authentication, heartbeat, presence, typing, event distribution | Online/typing only from live state; reconnect and refetch | `presence/presence.gateway.ts`, `presence/application/presence.services.ts` |
| Calls | Voice/video initiation, accept, decline, end; Socket.IO ring acknowledgment, SDP/ICE signaling; permission/state policies | Complete call-state system; native video presentation and audio-routing work remain | `calls/controllers/calls.controller.ts`, `calls/calls.gateway.ts`, `calls/domain/calls.domain.ts` |
| Date plans | AI/fallback suggestions; create/list/detail; accept/counter/decline/cancel/complete; private safety and meet-again responses | Core differentiated journey with versioned mutual acceptance and exact-venue privacy | `date-plans/application/date-plans.service.ts`, `date-plans/domain/date-plans.privacy.ts`, `date-plans/ai/` |
| Notifications | In-app/push records, list, individual read, event generation, dispatch job | Activity inbox; external push dispatcher currently logs rather than delivering | `notifications/controllers/notifications.controller.ts`, `notifications/application/notifications.services.ts` |
| Blocks | Create/list/remove block; relationship/conversation/call/date-plan effects | Clear consequences, blocked list, unblock without restoring ended match | `blocks/controllers/blocks.controller.ts`, `blocks/infrastructure/blocks.infrastructure.ts` |
| Reports | Create contextual report, duplicate handling, my reports, moderation-case creation | Reporting flow, submission acknowledgment, history/status; richer evidence upload not found | `reports/controllers/reports.controller.ts`, `reports/dto/reports.dto.ts` |
| Moderation | Cases, assignment/actions, account enforcement, photo moderation, trust score recomputation | Admin operations and consumer notice states; not proof of automated identity/safety checks | `moderation/application/moderation.services.ts`, `moderation/dto/moderation.dto.ts` |
| Analytics | Event ingestion and summary metrics | Instrumentation plus admin summaries; no consumer analytics dashboard | `analytics/controllers/analytics.controller.ts`, `analytics/dto/analytics.dto.ts` |
| Feature flags | Global/percentage/allowlist flags, variant/configuration, evaluation | Admin rollout forms; no consumer feature-flag destination | `feature-flags/dto/feature-flags.dto.ts`, `feature-flags/application/feature-flags.services.ts` |
| Admin | Admin-gated moderation, user detail/actions, feature flags, analytics, audit logs | Separate new desktop design; current routes require ADMIN, not MODERATOR | `admin/controllers/`, `admin/application/admin.services.ts`, `admin/policies/admin-role.guard.ts` |

Photos are a capability within Profiles rather than an additional backend module.

## Profile data, requirements, and constraints

The definitive completion evaluator is `aroha_backend/src/common/services/profile-completion.service.ts`. It requires an active account, a non-hidden profile, display name, valid bio, adult date of birth, city/region/country, coordinates/geohash, at least one intent, an approved photo and approved primary, valid discovery age/distance preferences, and a saved communication preference.

The current onboarding presents more sections than these minimum rules require. A redesign can defer interests, lifestyle, schedule, prompts, languages, and sensitive compatibility while preserving access rules. Show “required for discovery” separately from optional enrichment. A paused profile is additionally blocked by DiscoveryAccessPolicy.

| Data group | Fields / supported choices | Constraints |
| --- | --- | --- |
| Identity | Display name, headline, bio, DOB, gender, pronouns | Name ≥2 trimmed for completion, max 80; headline 140; bio 20–1,000; age 18+ |
| Gender | WOMAN, MAN, NON_BINARY, TRANS_WOMAN, TRANS_MAN, AGENDER, OTHER, PREFER_NOT_TO_SAY | Human-readable labels; inclusive choice, not an inferred trait |
| Location | City, region, 2-letter country, lat/lng, derived geohash | Public profiles show coarse location/distance; normal forms should not expose geohash |
| Intent | FRIENDSHIP, COMPANIONSHIP, SHARED_INTERESTS, RELATIONSHIP, DATING, COMMITTED_RELATIONSHIP, MARRIAGE_MINDED | At least one for completion |
| Relationship pace | SLOW_AND_STEADY, OPEN_TO_EXPLORING, INTENTIONAL, READY_TO_COMMIT | Optional |
| Smoking | NEVER, OCCASIONAL, REGULAR, PREFER_NOT_TO_SAY | Optional |
| Drinking | NEVER, OCCASIONAL, SOCIAL, REGULAR, PREFER_NOT_TO_SAY | Optional |
| Exercise | NEVER, OCCASIONAL, WEEKLY, FREQUENT | Optional; do not add an unsupported enum value |
| Diet | OMNIVORE, VEGETARIAN, VEGAN, PESCATARIAN, HALAL, KOSHER, OTHER, PREFER_NOT_TO_SAY | Optional |
| Pets | HAS_PETS, LIKES_PETS, NO_PETS, ALLERGIC, PREFER_NOT_TO_SAY | Optional |
| Sleep / social energy | EARLY_BIRD, FLEXIBLE, NIGHT_OWL / LOW_KEY, BALANCED, OUTGOING | Optional |
| Schedule | Weekday mask, time-block mask, weekends, remote-friendly, max weekly meetups, lead-time days, timezone | Present natural controls; time-block mapping mismatch needs resolution |
| Discovery | Min/max age, max distance, intention filter, preferred genders, recently-active toggle, same-city preference | Min age ≥18; max ≥min; distance ≥1 km; same-city is a preference, not exclusion |
| Communication | Voice, video, match/message/call push, read receipts | Six global booleans; match-level voice/video/mute also exist |
| Languages / food preferences | Arrays of text | Max 10 each; entry max 80 characters |
| Sensitive compatibility | Relocation, career priority, family involvement comfort, marriage timeline, children, religion/spirituality | Public visibility controlled by one shared opt-in flag, not per-field visibility switches |
| Prompt answers | Five fixed prompt IDs; three selected answers | Max 3 answers; each ≤500 characters |
| Privacy | hideAge, hideDistance, isHidden, isPaused, isIncognito, hideFromContacts, shareSensitiveCompatibility | Contact hiding is stored without a located enforcement flow |
| Verification | UNVERIFIED, PENDING, VERIFIED, REJECTED | Read/display status exists; no verification submission endpoint found |
| Photos | Gallery, order, primary, moderation result | JPEG/PNG/WebP, max 10 MB; no fixed gallery maximum verified |

Prompt IDs are `ideal_sunday`, `learn_together`, `healthy_relationship`, `made_my_week`, `make_me_laugh`. Definitions live in `aroha_backend/src/modules/profiles/domain/profile-prompts.ts` and `frontend-mobile/src/features/profile/profilePrompts.ts`.

## Important workflow rules

### Discovery and compatibility

`DAILY_CURATED_PROFILE_LIMIT` is 8. A snapshot lasts 24 hours and is keyed to viewer preferences. This implements a curated batch, not a demonstrated per-calendar-day quota. Candidate exclusions cover self, active likes/passes, matches, blocks, and unavailable accounts/profiles. Search attempts can widen distance up to the code's fallback range and extend recent activity from seven to thirty days.

The internal ranking blends intentions, shared interests, lifestyle, schedule, proximity, activity and trust. The public compatibility score is separately calculated and heuristic. Do not expose ranking weights or internal trust as consumer claims, and do not interpret an 80 score as an 80% probability of success.

Same-city preference affects sorting. `includeRecentlyActiveOnly` is saved/read but is not used by the inspected discovery query. Privacy mapping hides age/distance as applicable. Public sensitive fields are included only when the profile's sharing flag allows them.

### Interest → match → conversation

Create-like returns `LIKE_RECORDED` or `MATCH_CREATED` and may include match/conversation data. Reciprocal interest creates the relationship. Notes are private and limited to 300 characters. Retraction exists, but a full sent-likes-history endpoint does not. Removing a like should not be designed as an implicit unmatch.

Unmatch and block end related access; active plans are canceled. Unblock removes the block without reactivating the ended match. Public-profile access can remain possible for an existing like/match even when the profile is excluded from public discovery, so incognito/hidden copy should not promise an absolute audience that the policy does not enforce.

### Messages and calls

Messages: TEXT, IMAGE, VIDEO, AUDIO, SYSTEM. Message statuses: ACTIVE, PENDING_MODERATION, REMOVED_BY_MODERATION, DELETED_BY_SENDER. Edit is sender-owned text only, within 15 minutes. Deletion is sender-owned. Reply references are scoped to the conversation.

Attachment formats: JPEG/PNG/WebP, MP4/QuickTime, MPEG/MP4/AAC/WAV audio. Domain limits are 15 MB for image/audio and 50 MB for video, even though the generic upload DTO has a 50 MB ceiling. Image/video dimensions and video/audio duration are required during finalization.

Calls: RINGING, ACCEPTED, CONNECTING, CONNECTED, DECLINED, CANCELED, MISSED, ENDED, TIMED_OUT, FAILED. Reasons include hangup, declined/canceled/missed, blocked, unmatched, permission revoked, timeout and error. Both global and relationship-level permissions matter. Multiple-device acceptance has an explicit accepted-elsewhere event.

### Date planning and privacy

Suggestions take locality, atmosphere, future start time, timezone, 45–360 minute duration, budget bounds 0–100,000 and currency. Default currency is INR. AI-provider errors can fall back to deterministic suggestions; a disabled suggestions feature returns an unavailable response. Manual plan creation remains a distinct endpoint.

Creation immediately persists PROPOSED and the creator's acceptance of version 1. A counterproposal is allowed only while PROPOSED/COUNTERED, creates a new version, clears venue-reveal/acceptance state and records acceptance by the counterproposer. Acceptance by both participants for that version produces ACCEPTED.

Exact venue name/address/coordinates are hidden in returned plans until the accepted state has the required acceptance/reveal timestamps. COMPLETED plans can retain visibility. A declined/canceled proposal is not a confirmed date. The API does not provide editing/rescheduling an already accepted plan through counter. Model DRAFT does not imply a supported save-draft endpoint.

Check-ins record ARRIVED, OKAY, NEED_HELP or LEFT_EARLY. The response exposes only the viewer's safety status. `resolveMutualMeetAgain` returns MUTUAL only when both submitted responses are yes, otherwise null. Although the DTO includes NOT_MUTUAL, the privacy implementation deliberately does not emit it.

The mobile date-detail screen supports manual sharing through the native share sheet and a separate native emergency-dial action. Neither constitutes automatic contact alerts, monitoring, location tracking, or emergency dispatch. Suggestions have no verified venue inventory or booking integration.

## Admin capabilities and boundaries

The model includes USER/MODERATOR/ADMIN, but `AdminRoleGuard` allows only ADMIN. No separate operational moderator permission was found. There is no admin frontend route group in the inspected mobile app.

Supported desktop-console content:

- Case queue: status OPEN/IN_REVIEW/ACTIONED/CLOSED, priority LOW/MEDIUM/HIGH/CRITICAL, cursor pagination.
- Case details: subject/source report IDs, USER_REPORT/PHOTO_REVIEW/TRUST_REVIEW/PROFILE_REVIEW/MESSAGE_REVIEW type, assignment, summary, findings, action notes and timestamps.
- Case actions: NOTE_ONLY, WARN, REMOVE_PHOTO, HIDE_PROFILE, FREEZE_DISCOVERY, FREEZE_CHAT, FREEZE_CALLS, SHADOW_BAN, SUSPEND, BAN, RESTORE.
- Direct user actions: WARN, HIDE_PROFILE, FREEZE_DISCOVERY, FREEZE_CHAT, FREEZE_CALLS, SHADOW_BAN, SUSPEND, BAN, RESTORE. Case-only actions should not silently appear in the direct-user form.
- User detail by known ID: account, profile/photos, trust score/level/factors. No general user search or paginated user list.
- Analytics: 24h/7d/30d summaries of signups, active users, likes, matches, messages, reports, call attempts.
- Feature flags: global/percentage/user allowlist, enablement, percentage, variant/configuration.
- Audit entries: actor/session, action, entity, target user, IP/user agent, metadata, timestamp; filters for actor user, target user, entity type.

The code supports moderation actions, but photo review defaults to approval unless a job supplies another decision. Do not equate an APPROVED photo with verified identity or a safety guarantee.

## Implementation gaps designers must label

| Area | What exists | What must not be assumed |
| --- | --- | --- |
| Password lifecycle | Signup/login/password policy | OTP, recovery/reset, password change, social login |
| Account lifecycle | Account-status model and moderation | Consumer delete-account/data-export endpoints or an appeal process |
| Profile verification | Status model/DTO/badge | Selfie verification, KYC, submission or approval workflow |
| Contacts privacy | Stored hideFromContacts flag and UI toggle | Contact upload/matching/exclusion actually working |
| Incognito | Exclusion from public discovery and relationship-based read policy | Absolute “only people I like can ever see me” guarantee |
| Activity preference | Stored toggle and fixed fallback activity windows | Toggle being applied as a strict query filter |
| Time blocks | Mobile has five labels; backend description logic uses differing three-bit meanings | Existing labels being a consistent interoperable contract |
| Daily selection | Eight-item cap, expiring snapshot and remaining field | Hard midnight reset, strict daily quota, guaranteed eight new people |
| Incoming-like preview | Slim preview DTO with a narrower legacy intent union | All new intent labels and hidden-age handling being consistent across every DTO; review with full public-profile contract |
| Push | Records, preferences, token registration and jobs | External APNS/FCM delivery; PushDispatcherService is a logging stub |
| Media messaging | Full backend upload/message contracts, text/image current UI | Complete video/audio capture and playback, reply/edit/delete user controls already implemented |
| Calls | Backend lifecycle/signaling and client stream handling | Complete RTCView video layout, reliable native audio routing or independently verified encryption claims |
| Drafts/rescheduling | DRAFT enum; counter for pending proposals | Save-draft API or countering an accepted plan |
| Date assistance | Generated/fallback public-date ideas | Live venue availability, venue verification, booking, payments, calendar sync |
| Safety check-in | Private status storage, manual device sharing/dialing | Staff monitoring, automatic trusted-contact alerts or emergency dispatch |
| Reports | Create/list own/status | Report attachments, live support or appeals |
| Safety center | Disabled coming-soon row in Settings | Existing educational/support hub; a new hub can link supported tools |
| Notifications | Individual mark read | Bulk mark all read |
| History/search | Conversations, matches, incoming likes, notifications | Sent-likes history, call-history list, global user search or message search |
| Commercial/social | Dating relationships and plans | Subscriptions, boosts, superlikes, payments, events marketplace, groups, public feed, AI coach |

These boundaries prevent design mockups from being mistaken for already supported functionality. Proposed additions may be useful, but should be identified separately rather than removed from discussion or portrayed as implemented.

## Handoff and source access

`CLAUDE_DESIGN_PROMPT.md` is a complete prompt. Attach this feature map for the implementation reference. Both documents can be used without uploading the repository.

If you want Claude to inspect code directly, you must separately attach selected source files or grant access through whatever repository/file connection is available in your Claude environment. A local path in this document is not access permission or a live repository connection. Useful source is the backend module folders, schema, completion evaluator, and mobile feature/type/API/route folders. Environment files, signing material, database dumps, credentials, build outputs, dependencies and generated clients are unnecessary for the design task.

The inventories below were extracted from controller decorators and route filenames rather than copied from old documentation.

## Complete REST inventory

All routes below are declarations in current source, not an assertion of deployed availability. Consumer routes require authentication except signup/login/refresh as marked in the controllers; all `/admin/` routes require ADMIN.

| Method | Route | Source location |
| --- | --- | --- |
| GET | `/api/v1/admin/analytics/summary` | `aroha_backend/src/modules/admin/controllers/admin-analytics.controller.ts:13` |
| GET | `/api/v1/admin/audit-logs` | `aroha_backend/src/modules/admin/controllers/admin-audit.controller.ts:13` |
| GET | `/api/v1/admin/feature-flags` | `aroha_backend/src/modules/admin/controllers/admin-feature-flags.controller.ts:27` |
| PUT | `/api/v1/admin/feature-flags/:key` | `aroha_backend/src/modules/admin/controllers/admin-feature-flags.controller.ts:32` |
| GET | `/api/v1/admin/moderation/cases` | `aroha_backend/src/modules/admin/controllers/admin-moderation.controller.ts:31` |
| GET | `/api/v1/admin/moderation/cases/:caseId` | `aroha_backend/src/modules/admin/controllers/admin-moderation.controller.ts:36` |
| POST | `/api/v1/admin/moderation/cases/:caseId/assign` | `aroha_backend/src/modules/admin/controllers/admin-moderation.controller.ts:41` |
| POST | `/api/v1/admin/moderation/cases/:caseId/action` | `aroha_backend/src/modules/admin/controllers/admin-moderation.controller.ts:60` |
| GET | `/api/v1/admin/users/:userId` | `aroha_backend/src/modules/admin/controllers/admin-users.controller.ts:26` |
| POST | `/api/v1/admin/users/:userId/action` | `aroha_backend/src/modules/admin/controllers/admin-users.controller.ts:31` |
| POST | `/api/v1/analytics/events` | `aroha_backend/src/modules/analytics/controllers/analytics.controller.ts:19` |
| POST | `/api/v1/auth/signup` | `aroha_backend/src/modules/auth/controllers/auth.controller.ts:40` |
| POST | `/api/v1/auth/login` | `aroha_backend/src/modules/auth/controllers/auth.controller.ts:54` |
| POST | `/api/v1/auth/refresh` | `aroha_backend/src/modules/auth/controllers/auth.controller.ts:68` |
| POST | `/api/v1/auth/logout` | `aroha_backend/src/modules/auth/controllers/auth.controller.ts:80` |
| POST | `/api/v1/blocks` | `aroha_backend/src/modules/blocks/controllers/blocks.controller.ts:34` |
| DELETE | `/api/v1/blocks/:blockedUserId` | `aroha_backend/src/modules/blocks/controllers/blocks.controller.ts:52` |
| GET | `/api/v1/blocks` | `aroha_backend/src/modules/blocks/controllers/blocks.controller.ts:70` |
| POST | `/api/v1/calls` | `aroha_backend/src/modules/calls/controllers/calls.controller.ts:36` |
| POST | `/api/v1/calls/:callId/accept` | `aroha_backend/src/modules/calls/controllers/calls.controller.ts:54` |
| POST | `/api/v1/calls/:callId/decline` | `aroha_backend/src/modules/calls/controllers/calls.controller.ts:74` |
| POST | `/api/v1/calls/:callId/end` | `aroha_backend/src/modules/calls/controllers/calls.controller.ts:94` |
| GET | `/api/v1/conversations` | `aroha_backend/src/modules/conversations/controllers/conversations.controller.ts:39` |
| GET | `/api/v1/conversations/:conversationId` | `aroha_backend/src/modules/conversations/controllers/conversations.controller.ts:51` |
| GET | `/api/v1/conversations/:conversationId/messages` | `aroha_backend/src/modules/conversations/controllers/conversations.controller.ts:62` |
| POST | `/api/v1/conversations/:conversationId/read` | `aroha_backend/src/modules/conversations/controllers/conversations.controller.ts:77` |
| POST | `/api/v1/matches/:matchId/date-plan-suggestions` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:19` |
| POST | `/api/v1/matches/:matchId/date-plans` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:30` |
| GET | `/api/v1/matches/:matchId/date-plans` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:40` |
| GET | `/api/v1/date-plans` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:54` |
| GET | `/api/v1/date-plans/:id` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:62` |
| POST | `/api/v1/date-plans/:id/accept` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:67` |
| POST | `/api/v1/date-plans/:id/counter` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:77` |
| POST | `/api/v1/date-plans/:id/decline` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:88` |
| POST | `/api/v1/date-plans/:id/cancel` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:98` |
| POST | `/api/v1/date-plans/:id/complete` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:108` |
| POST | `/api/v1/date-plans/:id/check-in` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:118` |
| POST | `/api/v1/date-plans/:id/post-date-response` | `aroha_backend/src/modules/date-plans/controllers/date-plans.controller.ts:129` |
| GET | `/api/v1/discovery/feed` | `aroha_backend/src/modules/discovery/controllers/discovery.controller.ts:14` |
| GET | `/api/v1/interests` | `aroha_backend/src/modules/interests/controllers/interest-catalog.controller.ts:11` |
| PUT | `/api/v1/users/me/intents` | `aroha_backend/src/modules/interests/controllers/my-intents.controller.ts:17` |
| PUT | `/api/v1/users/me/interests` | `aroha_backend/src/modules/interests/controllers/my-interests.controller.ts:17` |
| GET | `/api/v1/likes/received` | `aroha_backend/src/modules/likes/controllers/likes.controller.ts:45` |
| POST | `/api/v1/likes` | `aroha_backend/src/modules/likes/controllers/likes.controller.ts:58` |
| DELETE | `/api/v1/likes/:targetUserId` | `aroha_backend/src/modules/likes/controllers/likes.controller.ts:76` |
| POST | `/api/v1/passes` | `aroha_backend/src/modules/likes/controllers/likes.controller.ts:94` |
| DELETE | `/api/v1/passes/:targetUserId` | `aroha_backend/src/modules/likes/controllers/likes.controller.ts:110` |
| GET | `/api/v1/matches` | `aroha_backend/src/modules/matches/controllers/matches.controller.ts:39` |
| GET | `/api/v1/matches/:matchId` | `aroha_backend/src/modules/matches/controllers/matches.controller.ts:51` |
| DELETE | `/api/v1/matches/:matchId` | `aroha_backend/src/modules/matches/controllers/matches.controller.ts:62` |
| PUT | `/api/v1/matches/:matchId/communication-settings/me` | `aroha_backend/src/modules/matches/controllers/matches.controller.ts:78` |
| POST | `/api/v1/messages/attachments/upload` | `aroha_backend/src/modules/messages/controllers/messages.controller.ts:45` |
| POST | `/api/v1/conversations/:conversationId/messages` | `aroha_backend/src/modules/messages/controllers/messages.controller.ts:56` |
| POST | `/api/v1/messages/attachments/finalize` | `aroha_backend/src/modules/messages/controllers/messages.controller.ts:75` |
| PATCH | `/api/v1/messages/:messageId` | `aroha_backend/src/modules/messages/controllers/messages.controller.ts:91` |
| DELETE | `/api/v1/messages/:messageId` | `aroha_backend/src/modules/messages/controllers/messages.controller.ts:109` |
| GET | `/api/v1/notifications` | `aroha_backend/src/modules/notifications/controllers/notifications.controller.ts:30` |
| POST | `/api/v1/notifications/:notificationId/read` | `aroha_backend/src/modules/notifications/controllers/notifications.controller.ts:42` |
| POST | `/api/v1/profiles/photos/upload` | `aroha_backend/src/modules/profiles/controllers/profile-photos.controller.ts:46` |
| POST | `/api/v1/profiles/photos/finalize` | `aroha_backend/src/modules/profiles/controllers/profile-photos.controller.ts:58` |
| PATCH | `/api/v1/profiles/photos/order` | `aroha_backend/src/modules/profiles/controllers/profile-photos.controller.ts:74` |
| PATCH | `/api/v1/profiles/photos/:photoId/primary` | `aroha_backend/src/modules/profiles/controllers/profile-photos.controller.ts:90` |
| DELETE | `/api/v1/profiles/photos/:photoId` | `aroha_backend/src/modules/profiles/controllers/profile-photos.controller.ts:107` |
| GET | `/api/v1/profiles/me` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:52` |
| GET | `/api/v1/profiles/:userId` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:59` |
| PATCH | `/api/v1/profiles/me` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:70` |
| PUT | `/api/v1/profiles/me/lifestyle` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:86` |
| PUT | `/api/v1/profiles/me/schedule-preference` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:102` |
| PUT | `/api/v1/profiles/me/discovery-preference` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:118` |
| PUT | `/api/v1/profiles/me/communication-preference` | `aroha_backend/src/modules/profiles/controllers/profiles.controller.ts:134` |
| POST | `/api/v1/reports` | `aroha_backend/src/modules/reports/controllers/reports.controller.ts:33` |
| GET | `/api/v1/reports/me` | `aroha_backend/src/modules/reports/controllers/reports.controller.ts:50` |
| POST | `/api/v1/push-tokens` | `aroha_backend/src/modules/sessions/controllers/push-tokens.controller.ts:27` |
| DELETE | `/api/v1/push-tokens/:tokenId` | `aroha_backend/src/modules/sessions/controllers/push-tokens.controller.ts:49` |
| GET | `/api/v1/sessions` | `aroha_backend/src/modules/sessions/controllers/sessions.controller.ts:32` |
| DELETE | `/api/v1/sessions/others` | `aroha_backend/src/modules/sessions/controllers/sessions.controller.ts:46` |
| DELETE | `/api/v1/sessions/:sessionId` | `aroha_backend/src/modules/sessions/controllers/sessions.controller.ts:66` |
| GET | `/api/v1/users/me` | `aroha_backend/src/modules/users/controllers/users.controller.ts:11` |

## Current mobile route inventory

Paths below are relative to `frontend-mobile/app/`. Layout files are excluded. The redesign can add client surfaces for backend-supported functions, such as report history and richer media controls.

- `(app)/(tabs)/chats.tsx`
- `(app)/(tabs)/connections.tsx`
- `(app)/(tabs)/date-plans.tsx`
- `(app)/(tabs)/discover.tsx`
- `(app)/(tabs)/profile.tsx`
- `(app)/conversation/[conversationId].tsx`
- `(app)/date-plan/[datePlanId].tsx`
- `(app)/date-plan/new.tsx`
- `(app)/match/[matchId].tsx`
- `(app)/notifications.tsx`
- `(app)/profile/[userId].tsx`
- `(app)/report.tsx`
- `(app)/settings/appearance.tsx`
- `(app)/settings/blocked.tsx`
- `(app)/settings/communication.tsx`
- `(app)/settings/edit-profile.tsx`
- `(app)/settings/index.tsx`
- `(app)/settings/privacy.tsx`
- `(app)/settings/sessions.tsx`
- `(auth)/login.tsx`
- `(auth)/signup.tsx`
- `(auth)/welcome.tsx`
- `(call)/active.tsx`
- `(call)/incoming.tsx`
- `(modal)/match-created.tsx`
- `(onboarding)/basic-info.tsx`
- `(onboarding)/bio.tsx`
- `(onboarding)/communication-preferences.tsx`
- `(onboarding)/discovery-preferences.tsx`
- `(onboarding)/index.tsx`
- `(onboarding)/intent.tsx`
- `(onboarding)/interests.tsx`
- `(onboarding)/lifestyle.tsx`
- `(onboarding)/photos.tsx`
- `(onboarding)/review.tsx`
- `(onboarding)/schedule.tsx`
- `index.tsx`

## Realtime inputs and background services

Client-to-server realtime events declared by gateway handlers:

- `presence.heartbeat`
- `conversation.typing.start`
- `conversation.typing.stop`
- `call.ring.ack`
- `call.offer`
- `call.answer`
- `call.ice`

The client handles system readiness/errors, presence, typing, match creation, message creation/update/deletion, read-state changes, notification creation, and call lifecycle/signaling events. These are live states within existing product surfaces, not additional navigation destinations. Sources: `frontend-mobile/src/types/realtime.ts`, `frontend-mobile/src/realtime/RealtimeProvider.tsx`, and backend presence/call event handlers.

Background processor source files:

- `aroha_backend/src/jobs/analytics/analytics-rollup.processor.ts`
- `aroha_backend/src/jobs/calls/call-cleanup-stale.processor.ts`
- `aroha_backend/src/jobs/date-plans/date-plan-reminder.processor.ts`
- `aroha_backend/src/jobs/likes/passes-cleanup-expired.processor.ts`
- `aroha_backend/src/jobs/moderation/message-attachment-moderation.processor.ts`
- `aroha_backend/src/jobs/moderation/photo-moderation.processor.ts`
- `aroha_backend/src/jobs/moderation/trustscore-recompute.processor.ts`
- `aroha_backend/src/jobs/notification/notification-dispatch.processor.ts`
- `aroha_backend/src/jobs/queue/default-queue.processor.ts`
- `aroha_backend/src/jobs/sessions/sessions-cleanup-inactive.processor.ts`

Infrastructure also includes PostgreSQL/Prisma persistence, Redis caches/presence/session support, BullMQ jobs, object-storage upload/download URLs, JWT authentication/refresh, and WebRTC TURN credentials. These require appropriate implementation/configuration and do not need consumer screens.

