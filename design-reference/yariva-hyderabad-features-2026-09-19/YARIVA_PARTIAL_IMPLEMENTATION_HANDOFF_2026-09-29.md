# Yariva partial implementation handoff — 29 September 2026

Destination: existing Codex task **Update Yariva mobile UI**, ID `01a099ed-5bbd-7de3-bbc7-715d05c8ce23`, workspace `/Users/mohdghouse/Documents/Aroha`.

The user asked to stop implementation in the planning task and provide a continuation prompt for this existing implementation task. Application edits stopped. These changes remain in the shared workspace; do not assume they are completed, tested or safe to deploy. This document records the partial state and is not a second progress tracker or a replacement product specification.

## Verified history and current status

The destination task's latest final response says **P4-02 complete; stopped before P4-03**. Its previous verified work includes Scenes, localization, casual solo meetups, reviewed venue suggestions, five-second Vibe media, Duo invitations/Scene consent, paired discovery and exactly-once four-vote matching. Its reported P4-02 checks were backend 36 suites/128 tests, mobile 29 files/107 tests, typecheck/lint, four-account API verification and wireless Samsung accessibility inspection without screenshots. Those results predate the partial changes below.

The single authoritative status file remains [YARIVA_IMPLEMENTATION_PROGRESS.md](/Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_IMPLEMENTATION_PROGRESS.md). P4-03–P4-07, HELLO-01–HELLO-04, Phase 5, Phase 6 and final QA are unticked. External notification receipt remains blocked by missing provider credentials. No feature completion was added for this partial work.

## Partial application changes

### Database and generated client

- Edited `aroha_backend/prisma/schema.prisma`: nullable solo `Conversation.matchId`, unique Duo subject, explicit conversation membership, group plan/version responses, and call purpose/context fields.
- Added **unapplied** migration `aroha_backend/prisma/migrations/20260929000000_duo_conversations_and_voice_hello/migration.sql`. It includes a one-subject check, membership/backfill SQL, group plans and acceptance responses, call fields/checks, and trigger-based invalidation on party membership/status changes and blocks.
- Ran `npm run prisma:generate`, regenerating `aroha_backend/src/generated/prisma`. The CLI reported Prisma 7.9.1. The database has **not** been migrated for these new client expectations. Review the migration and validate on an isolated database before applying it to the local app data; preserve existing conversations and media.

### Duo conversations and group plans

- New structural participant/relationship helpers: `aroha_backend/src/modules/conversations/domain/conversation-context.ts`.
- Changed conversation repository, policy, service and DTO contracts to support immutable intended four-member snapshots and nullable solo subjects. Added `ensureDuoConversation` to create snapshots/read rows in the Duo-match transaction. Existing solo relationships remain the solo subject.
- Changed message access, recipient fanout, attachment moderation, reports and presence/realtime handling to recognize group members. Conversation DTOs now include `kind`, `participants`, `duoMatchId` and nullable `matchId`. These shared changes require regression review.
- Added `aroha_backend/src/modules/wingman/dto/duo-plan.dto.ts`, `application/duo-plan.service.ts` and `controllers/duo-plans.controller.ts`, registered through `wingman.module.ts`.
- Draft authenticated routes: GET/POST `/wingman/conversations/:conversationId/plans`, POST `/wingman/plans/:planId/respond`, POST `/wingman/plans/:planId/counter`.
- Draft plan behavior: a public activity/place/time proposal, one open plan, expected-version checks, proposer acceptance, all-four acceptance, counterproposal version increment, decline/cancel and realtime update. Group venue discovery is **not** implemented in this draft; the current draft accepts manual public-place details.
- Duo discovery DTO/service now return `conversationId`; `frontend-mobile/src/types/wingman.ts` was updated for that field.

### Optional guided voice introduction

- Added `aroha_backend/src/modules/calls/domain/voice-introduction.ts`, selecting a generic or shared-Scene topic (`coffee`, `food`, `walk`, `study`) without an AI API.
- Changed existing call DTOs/repository/service to carry `STANDARD` or `VOICE_INTRODUCTION`, a topic identifier and an optional suggested duration. Voice introductions use the existing solo match/call permissions and audio call signaling. Added match-level initiation locking.
- Added validated RTC configuration for `RTC_VOICE_INTRODUCTIONS_ENABLED` and `RTC_INTRODUCTION_SUGGESTED_SECONDS`, plus corresponding credential-service getters. Removed the placeholder STUN default; available real environment configuration must be verified. Environment/example documentation is unfinished.
- There is **no frontend invitation, topic rendering or voice-introduction journey yet**. Existing mobile call types and screens have not been reconciled with the new backend fields. A suggested duration is not a forced call cutoff.

### Other affected areas to inspect selectively

Conversation and message application/domain/infrastructure/DTO files; reports application/infrastructure; `src/jobs/moderation/message-attachment-moderation.processor.ts`; presence service/module/domain-event subscriber and its existing spec; Duo discovery service/DTO/module; calls service/repository/DTO; RTC config, validation schema and TURN credential service. Paths above are relative to `aroha_backend` unless otherwise stated. Generated Prisma output was regenerated rather than hand edited.

## Known unfinished work and review priorities

1. **Mobile contracts/UI are incomplete.** Chat, chat lists and call screens still assume one peer and a non-null solo match. Reconcile contracts, request/cache/socket handlers and fixtures before serving Duo conversations. Show all four people explicitly, hide unsupported solo actions, and preserve existing solo flows.
2. **Read-state transaction race.** `MarkConversationReadService` checks authorization before its update transaction. Revalidate membership/relationship inside the transaction with compatible locks and prevent read-state regression.
3. **Message mutation transaction race.** The edit/delete access lookup does not acquire the same Duo party locks as the conversation path. Review all write/attachment/finalize/edit/delete/read operations against simultaneous block, leave and replacement, including idempotent replay.
4. **Realtime access policy needs review.** The draft fanout guards conversations when recipient count exceeds two. Authorization must follow the actual relationship/membership, not the number of recipients. Check room subscriptions, reconnect, attachment URLs, queued events and ordering; optimize bounded repeated lookups where necessary.
5. **Migration/locking needs real PostgreSQL validation.** Verify subject uniqueness, exactly four distinct snapshot members, valid old-match backfills, trigger permissions/search path, block/leave invalidation, constraint behavior and deadlock ordering. A newly invited buddy must never inherit an old conversation. Specify history access and moderation retention.
6. **Plans need full integration.** Reuse public venue search with a documented private four-person geographic-center strategy. Review idempotency, stale version handling, concurrent create/respond/counter/cancel and plan ownership. The counter DTO currently accepts a request ID that the draft does not use. Centralize bounded policy values/configuration where appropriate.
7. **Calls need regression coverage.** Review duplicate initiation/accept/decline/cancel races, both users' communication permissions, background/reconnect, topic privacy and standard audio/video behavior. Existing call test doubles may need the new transaction/config methods. No group or cross-Duo private calls are authorized.
8. **Complete actual tests and device verification.** Draft code and existing historical tests are insufficient. Finish P4-03–P4-07 and HELLO checks with evidence in the single tracker; do not tick anything merely because files exist.

## Checks performed for this partial state

- `npm run prisma:generate`: passed.
- Backend `npm run lint` (`tsc --noEmit --pretty false`): returned exit code 0. Log: `/tmp/yariva-backend-check.log`.
- New SQL migration: **not applied or runtime-tested**.
- New unit/integration suites, full backend build/regression and mobile typecheck/regression: **not run for this partial state**.
- Physical-device, four-account group and two-client voice verification: **not run for this partial state**.
- No backend/Metro restart, environment replacement or deployment was performed for these changes.

## Runtime observations from 29 September

These are observations to recheck, not permanent configuration:

- Samsung serial `RZCW40V652L` appeared online over USB; the old wireless relay `127.0.0.1:5556` was offline. Verify wireless connectivity before claiming it works or asking the user to unplug USB.
- Metro port 8081 had no running Metro. Port 3000 belonged to an unrelated Python process; do not kill it. Select a free backend port and update the existing mobile/device routing consistently if needed.
- Local PostgreSQL/PostGIS and MinIO containers were running, with ports 55432 and 59000 respectively. Check Redis, worker and private-media routing rather than assuming older PIDs are valid.
- STUN configuration existed; TURN URLs were not configured. Validate available two-client media coverage and report network/provider limitations truthfully.
- No Git metadata was found in the workspace. Preserve shared files and use targeted comparisons/backups; do not run a broad reset or deletion to remove these partial edits.

Use the [continuation prompt](/Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_CONTINUATION_PROMPT_2026-09-29.md) in **Update Yariva mobile UI**. No message has been dispatched to that task by this handoff.
