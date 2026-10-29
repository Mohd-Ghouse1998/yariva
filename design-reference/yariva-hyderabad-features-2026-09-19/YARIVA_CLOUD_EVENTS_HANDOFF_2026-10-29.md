# Yariva cloud continuation — Events

Prepared 29 October 2026. This is portable context, not a second task tracker.

## Start here

Repository: `git@github.com:Mohd-Ghouse1998/yariva.git`. Handoff branch: `main`. The sending chat will supply the exact pushed commit SHA. First inspect Git status, preserve any existing cloud work, fetch origin and verify that your working branch includes that SHA before editing. Do not hard-reset, force-push or discard another session's changes. Use the cloud environment's branch/PR workflow; use `codex/` for a new branch if one is needed. The previous local writer has stopped editing.

Resolve paths from the cloud checkout root; the Mac path in historical documents is not a required directory. Read:

1. Applicable `AGENTS.md` and [the tracker checkpoint and EVM-01–08](YARIVA_IMPLEMENTATION_PROGRESS.md).
2. [The master prompt](YARIVA_FULL_STACK_UI_UX_MASTER_PROMPT_2026-09-20.md): shared engineering/UI/privacy rules and section 13B. Latest Events instructions below override the older proposal to bury Events inside Meetups.
3. Relevant implementation and callers/tests, then supporting documents only as needed: `YARIVA_HYDERABAD_FEATURE_PLAN.md`, `YARIVA_ARCHITECTURE_DECISIONS.md`, `YARIVA_CONSENT_LED_SOCIAL_EXPRESSION_RESEARCH_2026-10-19.md`, `aroha_backend/docs/implementation/private-stories-privacy-adr.md`, `frontend-mobile/DESIGN.md` and `frontend-mobile/src/theme/MIGRATION.md`.

## Implement Events now

Replace the visible **Meetups** bottom tab with **Events**, using a vertical, photo-led, paginated feed comparable in browsing simplicity to Discover. Keep all existing solo/Duo DatePlans, chat invitations, routes and safety functions reachable through a compact **My plans** entry. Preserve the other tabs and existing business behavior.

When the first successful Events discovery result has no eligible events, show real reviewed cafés/restaurants as **Places to meet**, respecting the same location/filter constraints. Never substitute places for loading, network errors, offline state or an empty Saved list. Do not claim a venue is nearby without location/distance evidence. Support consented location and a manual location path using existing architecture. Do not manufacture events, ratings, safety verification, attendance or partnerships.

Use Yariva's existing compact, modern Warm Human Modern shared theme: ivory/white/ink/sand, restrained coral/terracotta, existing Inter and Space Grotesk. Photography leads. Keep controls discoverable, 48dp touch targets, safe areas, large-text reflow, light/dark support and clear loading/empty/error/disabled states. Avoid bulky cards, excessive instructions, new font/theme systems and redundant CTA rows.

Complete coherent backend-to-mobile slices against **EVM-01–08 in the existing tracker**. Reconcile authored work first; do not recreate it. Start with admin-curated Hyderabad supply; organizer submissions are conditional on actual pilot need. No paid-provider signup or production deployment is authorized. Preserve official sources, freshness, schedule/timezone/cancellation, rights to images and unknown-versus-free pricing. Protect private saves, adult eligibility, active-match/block rules, location and LGBTQ+ identity. Event changes must trigger existing plan version/reconfirmation rules. Check reporting and invitation failure/retry/race paths rather than assuming UI implies enforcement.

## What already exists, and what is missing

- Backend: `aroha_backend/src/modules/events/`, `prisma/schema.prisma`, and `prisma/migrations/20261029130000_curated_events/`. EventListing/SavedEvent, catalog/detail/save/admin services and DatePlan event/version integration have been authored. Inspect module registration, flag defaults, policy and migration before using them. The previous implementer reports this Events migration has not been applied.
- Mobile: `frontend-mobile/app/(app)/events/`, `src/features/events/`, `src/api/endpoints/events.ts`, `src/types/events.ts` and DatePlan integration. The current Events screen is a secondary compact list. `src/components/navigation/FloatingTabBar.tsx` still labels the DatePlans tab **Meetups**. The requested main feed and real places fallback are incomplete.
- Existing unit coverage includes backend `src/modules/events/events.policy.spec.ts` and mobile `src/features/events/eventPresentation.test.ts`. Unit passes do not establish live database/API/Android acceptance. Investigate report paths, selection/reload, idempotent retries after event changes and existing venue restrictions before changing them.
- The snapshot also preserves recent Stories moderation/archive/cleanup, notifications, discovery hobbies/work-category filters, profile and related UI/tests/docs. Do not undo these while completing Events. Private Stories remain distinct from discoverable Scenes, with server-enforced audience rules and 24-hour recipient expiry. Owner saving never extends recipient access.

## Setup and evidence

Use actual package manifests/lockfiles, not old README version assumptions. Backend is NestJS/TypeScript/Prisma/PostgreSQL with PostGIS, Redis/BullMQ and S3-compatible storage. Mobile is Expo SDK 56 / React Native with Expo Router. Install each package with `npm ci` when needed. Read `.env.example`; provision development/test credentials privately. Never commit secrets or put secrets in `EXPO_PUBLIC_*` values. Regenerate ignored Prisma output using backend `npm run prisma:generate` with an appropriate test/development DATABASE_URL.

Fresh checks on this handoff snapshot:

- Backend `npm run lint` (TypeScript): passed.
- Backend `npm test -- --runInBand`: 46 suites, 229 tests passed.
- Mobile `npm run typecheck`, `npm run lint`: passed.
- Mobile `npm test`: 57 files, 324 tests passed.
- `git diff --check`: passed before this documentation update; recheck your final diff.

No migration, live integration suite or device acceptance was run during packaging. Older integration/device results in the tracker remain dated evidence. Mac credentials, local database/media/demo rows, Metro, wireless phone connection and `/tmp` logs do not transfer through Git. Do not claim cloud can inspect the physical phone or that the Git commit contains its database.

Backend scripts include `prisma:migrate:deploy`, `prisma:seed`, `test:integration:live` and `test:integration:live:docker`. Inspect them before running. `docker-compose.integration.yml` uses PostGIS, Redis and MinIO; the live integration script tears down volumes. Use only a dedicated isolated test Compose project/database/storage, never production or shared user data. Record migration/fresh-install and affected authorization/concurrency/integration results. If Docker/services are unavailable, use supported isolated CI infrastructure or record the precise blocker; do not replace live acceptance with mock success. Native WebRTC requires a development build, not Expo Go.

## Working rules and finish

Reuse existing DatePlans, chat, venue, admin, authorization, error handling and theme utilities. Centralize real shared logic; avoid duplicate layers, hardcoded data, speculative abstractions, new dependencies and unrelated refactors. Use parameterized/Prisma queries, server-side authorization, bounded pagination, appropriate indexes and race-safe mutations. Read targeted files first, keep output bounded and reuse passing checks while code remains unchanged.

Maintain **only `YARIVA_IMPLEMENTATION_PROGRESS.md`** as the completion tracker. Update relevant EVM IDs after meaningful work, with actual commands/results, remaining work and blockers. Tick only satisfied acceptance criteria. Leave device/provider/release checks pending when unavailable. Do not pause all independent implementation merely because the cloud has no phone. Finish with changed behavior/files, tests, migrations and exact remaining acceptance work; do not describe the app as fully production-ready without evidence.
