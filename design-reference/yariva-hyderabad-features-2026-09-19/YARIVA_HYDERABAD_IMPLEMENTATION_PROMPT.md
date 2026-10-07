# Copy-ready implementation prompt: Yariva Hyderabad features

**Superseded on 20 September 2026:** use [the consolidated full-stack UI/UX master prompt](/Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_FULL_STACK_UI_UX_MASTER_PROMPT_2026-09-20.md) for the latest implementation request. It adds the Thursday event, Sunday recap, shared planning refinements and explicit UI/device acceptance criteria. This earlier version is retained for reference.

Copy the prompt below into a coding agent that can access this workspace. This consolidated prompt replaces the overlapping feature prompts. The companion `YARIVA_HYDERABAD_FEATURE_PLAN.md` explains the reasoning; this prompt is independently actionable.

---

Act as the lead full-stack engineer for **Yariva**, an existing adult dating and friendship app serving Hyderabad/Telangana. Implement the eight modules below in my current codebase. Edit and integrate actual files; do not stop at illustrative code blocks, a scaffold or another implementation plan.

Work in tested phases. Complete each vertical slice across migrations, backend, mobile UI and verification before progressing. Continue through the scoped phases without requesting routine implementation approval. Preserve existing user data and working flows. If an external dependency is unavailable, complete independent local work, keep the affected feature disabled and state the precise remaining limitation. Never label a stub or an untested flow production-ready.

## A. Repository and UI constraints

Workspace: `/Users/mohdghouse/Documents/Aroha`.

- Backend: `aroha_backend`, NestJS 11, Prisma 7, PostgreSQL, Redis/BullMQ, Socket.IO and S3-compatible private storage.
- Mobile: `frontend-mobile`, Expo SDK 56, React Native, Expo Router, Zustand, Reanimated and `expo-image`.
- Re-read actual package versions, scripts, relevant files and any applicable `AGENTS.md` before changes. Check working-tree status if Git exists; do not assume this directory is a repository or reset unrelated files.
- Do not introduce a replacement Flutter, Firebase, Next.js, Express or Supabase application.
- Reuse existing modules for authentication, eligibility, profiles, storage, discovery, likes/matches, conversations, Date Plans, notifications, errors, analytics and feature flags.
- Preserve **Space Grotesk headings, Inter body text**, and the existing v3-derived buttons, input fields, sheets, spacing, touch targets and responsive behavior. The current `src/theme/colors.ts` uses warm neutrals/charcoal, restrained champagne and semantic teal. Use those tokens; do not redesign the palette or navigation for this task.
- Keep existing UX unless a new feature requires an addition or an observed defect needs repair. Validate light/dark mode, safe areas, large text, screen readers and keyboard behavior. Do not create a Figma file.

Start by inspecting:

```text
aroha_backend/prisma/schema.prisma
aroha_backend/src/modules/discovery/application/discovery.services.ts
aroha_backend/src/modules/date-plans/application/date-plans.service.ts
aroha_backend/src/modules/date-plans/domain/date-plans.privacy.ts
aroha_backend/src/modules/profiles/application/profile-photos.services.ts
aroha_backend/src/modules/likes/application/likes.services.ts
aroha_backend/src/jobs/queue/default-queue.processor.ts
frontend-mobile/src/theme/typography.ts
frontend-mobile/src/theme/colors.ts
frontend-mobile/src/theme/responsive.ts
frontend-mobile/src/features/safety/BlockConfirmModal.tsx
```

Known facts to revalidate: accounts use `User`/`UserProfile`, not an assumed lowercase `users` table. Coordinates are currently profile latitude/longitude decimals, not an existing PostGIS column. Discovery caches snapshots for 24 hours. `Match` and its conversation are currently two-person models. Date Plans already support proposal versions and venue-visibility rules. The current push dispatcher contains a delivery stub; do not claim background push works without a real tested transport.

## B. Shared implementation rules

1. Use additive Prisma migrations with actual SQL for spatial indexes, constraints and the streak function/trigger. Never rewrite previously applied migrations, drop user data, or apply destructive production changes as a shortcut.
2. Use strict TypeScript, runtime-validated DTOs, authenticated actor IDs and consistent existing error responses. Do not accept actor identity, payment status, reward amounts or reveal counters as trusted client input. Share/generate API contracts using repository conventions; never expose Prisma entities directly to mobile.
3. Store instants as UTC `timestamptz`; use `Asia/Kolkata` explicitly for calendar rewards. Money is integer INR paise. Points are a separate, non-cash, non-transferable balance.
4. Add database-level uniqueness/check constraints for invariants, parameterized queries, transaction boundaries and bounded retries for concurrency conflicts. External provider calls occur outside database transactions through durable commands.
5. Enforce blocks, moderation, deletion, visibility and membership on API reads/writes and socket subscription/delivery. Feature flags must gate backend access as well as mobile UI.
6. Keep new behavior off for uncontrolled production cohorts. Enable local/test fixtures explicitly. Supply deterministic, clearly synthetic seed data. Never invent real venue verification, payment success or test results.
7. Register every job in the existing worker bootstrap/processor. Treat the database as authoritative; socket events are hints followed by re-fetch. Add a durable outbox for operations that cannot be lost, plus deduplication and recovery sweeps where appropriate.

## C. Module 1 — Scenes and hyperlocal intent matching

Create a normalized `Scene` with an ID, owner, intent enum `DATING | FRIENDSHIP | CASUAL_HANG`, display activity text, canonical activity tags, creation/expiry timestamps, status and version. Default expiry is 12 hours from server creation. Maintain one active Scene per owner with a transactional replace/end flow. Derive a `current_scene_status` API object instead of maintaining inconsistent copies of several user fields.

Add authenticated create/update/end/current-scene endpoints and integrate `getIntentMatches(userId)` with existing discovery. The server obtains the viewer's Scene and location. Match candidates must:

- Be within 15,000 metres using PostGIS geography and an appropriate GiST index.
- Have the same Scene intent and an unexpired Scene; the viewer's Scene must also be active.
- Share a canonical activity tag, or meaningful normalized text tokens for uncategorized legacy/free-text entries. Use reviewed aliases and stopwords, not arbitrary substring overlap or an unrequested external AI service.
- Pass all existing account, adult eligibility, mutual preference, visibility, moderation, block and relationship exclusions.

Implement PostGIS installation/migration preflight, validated point backfill and integration with the existing coordinate update path. Use longitude-first `ST_MakePoint` and metre-based geography; never use 15,000 as a distance on SRID 4326 geometry. Handle null, invalid and stale locations explicitly. Document the freshness policy rather than guessing silently.

Use deterministic pagination and approximate displayed distance. Cache by discovery mode, Scene and party version; revalidate expiration and eligibility on cached reads. Do not use volatile `now()` in a partial-index predicate. No expired Scene may survive solely because the old discovery cache lasts 24 hours.

On mobile, add “Your scene”, a short composer and an opt-in Scenes discovery mode. Preserve ordinary discovery when no Scene is active. Do not automatically match people solely because their tags overlap; reuse mutual-interest consent. Expiration ends availability, not an existing conversation. Distinguish empty results, permission denial, offline state and loading. Never return another user's exact coordinates.

This opt-in mode and structured tagging intentionally refine the earlier free-text-only specification.

## D. Module 2 — Midpoint venue suggestions

Create a curated venue model with UUID, name, geography point, review status defaulting to `PENDING`, review source/notes, reviewed timestamp, available/closed state and optional useful price/accessibility fields. A compatibility `is_safe_verified` flag must default to false. Venue review is not a guarantee of safety.

Implement `calculateMidpoint(userACoords, userBCoords)` with spherical geometry and coordinate validation. Handle identical and antipodal inputs. Implement `calculateMidpointAndFetchVenues` to return at most three reviewed, available public venues near that midpoint within a configurable bound. Return fewer or none when appropriate.

The public API accepts a match/plan identifier and authorizes membership; obtain coordinates privately on the server. Do not expose raw participant locations or the midpoint. Do not let callers query arbitrary users' coordinates. Add tests for access control and repeated unauthorized lookups.

Integrate venue cards into the existing chat Date Plan composer with “Suggest this place”. Preserve plan versions, acceptance and `canRevealExactVenue`. Public catalog candidates must not leak a selected plan venue whose exact details are still withheld. Treat initial results as near a geographic midpoint, not as equal travel-time recommendations.

Seed synthetic Hyderabad-area fixtures with conspicuous demo labels. Do not fabricate coordinates, hours, ratings or reviewed badges for actual businesses. Real catalog enrichment, ads and new-opening detection are outside this implementation.

## E. Module 3 — Vibe media

Implement private audio/video upload, processing, validation and playback. Store a media record containing owner, storage key, kind, server-measured duration, processing/moderation state and renditions; return an authorized `vibe_check_url` in a DTO when needed. Do not store an arbitrary user-supplied URL as validated media.

Extend the existing initiate/finalize storage flow. A worker must inspect actual uploaded bytes with ffprobe or equivalent, under byte/resolution/codec/time/resource limits. Use safe process argument arrays and cleanup. Verify ownership, file signatures, decoding and every playable stream. Enforce finite `0 < duration <= 5.0` seconds; reject longer content, including audio that outlasts the video. Reject ambiguous or missing timing metadata. Validate any generated rendition again. Never trust client duration or fetch arbitrary URLs.

Implement `UPLOADING -> PROCESSING -> READY` and rejected/failed/removed states. Profile publication must check a ready, eligible asset on the server when the requirement policy is enabled. Make the publishing requirement feature-configurable and optional for the initial pilot; migration must not suddenly unpublish existing users. This is an intentional change from an unconditional mandatory-media rule.

Use compatible Expo SDK 56 audio/video packages through the supported Expo installation flow. Add recording/upload permissions only as required and explain them in UI. Provide a five-second preview card with play/pause, progress, processing/retry states, accessibility labels and background/navigation cleanup. Do not autoplay audio without user action. Support an accessible audio alternative. Never describe a clip as proof of identity or as eliminating catfishing.

## F. Module 4 — Blind Vibe

Implement `VibeBlurContainer` with the requested `isBlindVibeActive`, `interactionCount` and `children` props, plus an explicit protected image source or controlled image render slot. A generic View does not blur its children. Keep controls readable and unblurred.

Use:

```ts
const safeCount = Number.isFinite(interactionCount)
  ? Math.max(0, Math.min(10, interactionCount))
  : 0;
const blurRadius = isBlindVibeActive ? 20 * (1 - safeCount / 10) : 0;
```

Use the installed image renderer's supported blur behavior. Handle placeholders separately. The formula is a visual effect, not an authorization boundary.

Server-side policy applies to new, mutually opted-in blind introductions. Count eligible persisted human messages per participant, deduplicating retries and excluding system events/spam. Default progress is `min(countA, 5) + min(countB, 5)` so one person cannot unlock with ten messages. Document the spam/eligibility rule. Preserve compatibility with a future configurable threshold without trusting a client counter.

Before authorized reveal, deliver only approved blurred derivatives and do not send/cache/prefetch original URLs or unblurred thumbnails through any profile/avatar/notification endpoint. Avoid leaks from placeholders and video. Blind introductions use audio-only Vibe previews unless both parties authorize an early reveal. Local global-setting changes must not override relationship consent. Do not imply that already-viewed photos can be hidden retroactively. On expiry/revocation, invalidate future access according to the documented retention/cache policy.

## G. Module 5 — Wingman

Create parties, explicit membership/roles, hashed expiring invitations, versioned active Scene consent, per-member votes and canonical pair matches. Use `PENDING`, `ACTIVE` (or consistently mapped `ACCEPTED`), `DECLINED`, `EXPIRED` and `DISCONNECTED` as needed.

The leader invites a specific buddy with an authenticated action and safe deep link. Store a cryptographically random token hashed, with expiry, invitee binding and one-time consumption. Do not publish the buddy or enable matching before explicit acceptance. Prevent self-invites, blocked-user invites and membership in multiple active/reserved parties with database-backed concurrency protection. Rate-limit invitation attempts.

Both members consent to the current Scene/version. When Wingman mode is on, discovery returns active paired cards only. If a party or Scene expires, require explicit recovery/renewal; do not silently return solo cards. Exclude parties containing the viewer, blocked/ineligible users or stale consent.

Default pair policy: all cross-party member distances meet the 15 km bound, and all members pass account/block checks. For dating, require at least one complete one-to-one pairing that satisfies mutual preferences for both potential couples: A1–B1 and A2–B2, or A1–B2 and A2–B1. Do not require everyone to be romantically compatible with both opposing members, or expose private preference reasons. Apply the appropriate friendship policy separately. Require both members of A to approve B and both members of B to approve A. Create one canonical match transactionally only after all four approvals. Votes must reference the current membership/Scene versions. Any membership change invalidates pending votes.

Build invite/accept/decline/leave, partner status, paired discovery, approval status, mutual match and four-person conversation UI. Extend chat with real group membership and authorization; do not impersonate a leader or wedge four users into the existing two-person Match. Choose a group-specific subject or a migrated subject abstraction with an exactly-one-subject constraint, and regression-test solo conversations.

On block/leave/disconnect, freeze further group communication and revoke sending/socket access immediately. Specify historical visibility and moderation retention. Test with four accounts. Four-person financial commitments and a full group Date Plan redesign are outside this initial Wingman scope.

## H. Module 6 — Hyderabad localization

Add stable JSON localization keys, fallback English, interpolation and an optional Hyderabad casual tone independent of language choice. Preserve these requested draft strings:

```json
{
  "discovery.empty.casual": "Scene light undi right now, change your spot!",
  "safety.block.casualCandidate": "Baigan mein mila do",
  "datePlan.invite.casual": "Kya bolte, scene kya hai?"
}
```

Use the casual empty message only for a genuine empty feed, not for connectivity/location errors. Keep the primary block action and confirmation explicitly labelled “Block user”; the slang entry is candidate secondary copy. Keep reporting, consent, permissions, payment/refund and irreversible actions clear. Mark casual copy for Hyderabad-native review; do not pretend these mixed phrases are verified Telugu translations. Test long strings, large text and accessibility labels.

## I. Module 7 — Daily Social Streak

Create `UserStreak` with user ID, nonnegative current/longest streak, nullable `lastActivityDate` initially NULL and nonnegative points balance. Add trusted qualifying activities and an immutable points ledger with unique activity and user/day award keys.

Qualifying action for this version: an eligible, user-initiated Scene publication, validated by the backend. No rewards for logins, swipes, automatic renewals, edits or raw message counts. These are cosmetic non-cash points with no transfer, redemption or purchase feature.

Implement backend-only `increment_user_streak(target_user_id UUID)` and a trigger on trusted activity insertion. Restrict who can insert activity records and execute the function. User IDs come from authenticated services, not an arbitrary public award endpoint.

Within the caller's atomic transaction, capture server time once, derive the `Asia/Kolkata` date, initialize/lock the row and apply:

- NULL last date: streak 1, award 10.
- Same date: no additional award.
- Yesterday: increment streak; award `min(10 * updatedStreak, 50)`.
- Older: reset streak to 1 and award 10.
- Future stored date: do not award; surface an integrity anomaly.
- Always update longest with `greatest(previousLongest, updatedStreak)` when awarding.

Persist the event, unique award, balance and streak together; return JSON with current/longest streak, balance, activity date and awarded points. Concurrent calls and retries must award once. Do not initialize last activity to today; that skips the first reward. Process the qualifying award synchronously with its activity, not in unordered delayed jobs. Derive expired displayed streaks accurately after a gap.

Prefer restricted `SECURITY INVOKER`. If using `SECURITY DEFINER`, use a trusted search path, schema-qualified objects, revoke PUBLIC execution and grant only the backend role in the same migration transaction. Do not put transaction COMMIT/ROLLBACK inside an ordinary SQL function, call payment APIs from triggers, or let clients manipulate balances.

## J. Module 8 — Commitment stake, MOCK ONLY

Implement `DateCommitmentEscrow` linked to an accepted solo Date Plan/version, participant records, attendance evidence, payment attempts, balanced journal entries, a dispute/review path and durable outbox/provider-event inbox records. Default stake is 9,900 INR paise per person.

Build a `PaymentProvider` interface and deterministic mock adapter. No real UPI credentials, fund collection, live transfers, cash wallet or redeemable balance. Label all payment UI and seed data as simulated. Prevent production configuration from accidentally routing this experiment to a real provider.

Separate funding, attendance, execution and final outcome. Funding needs unfunded/pending/captured/failed/refund-pending/refunded; attendance needs expected/checked-in/no-show-candidate/review; execution needs awaiting-funds/held/settling/settled/cancelled/disputed. Do not initialize someone as STAKED before confirmed mock capture. An instruction to refund is not a confirmed refund.

Bind immutable agreed terms to participants, venue, target timestamp, plan version and currency. Rescheduling/counteroffers cancel/refund the old commitment in this initial implementation; a new agreement creates a new one. Define funding and check-in windows explicitly in configuration and UI.

Implement `verifyVenuePresence(userId, dateId, venueQrPayload)` with:

- Authenticated membership and current commitment/version checks.
- Server-signed, short-lived QR/challenge verification: venue, issuer/key, timestamp, expiry and replay controls scoped correctly for each participant.
- Fresh coordinate and accuracy validation against a configured venue geofence and attendance window.
- Row locks/version checks and idempotent attendance transitions.
- Retry/review for denied permission or ambiguous evidence; GPS/QR is imperfect evidence, not proof. Do not reuse a self-reported ARRIVED status as verified presence.

Use delayed BullMQ jobs plus a recovery sweep for `handleEscrowTimeout(dateId)` at target time + 30 minutes. Recheck the database deadline/state under the same lock used by check-in. Timers and jobs can be late or duplicated; handle both.

Required mock outcomes:

1. Both attend: refund each person's own 9,900 paise.
2. Only A attends and B's no-show is finalized under the agreed mock policy: refund A's 9,900 plus a separate compensation payout of B's 9,900 to A. Total distributed is 19,800 paise, not a duplicated balance.
3. Only B attends: symmetric outcome.
4. Neither attends: review; explicit cancellation resolution refunds both, never pays a fabricated beneficiary.
5. Only one funds before the funding deadline: cancel and refund that payer.
6. Venue closure, safety cancellation, conflicting evidence or dispute: suspend automatic settlement and expose a clear mock review/refund path. Authorize review resolution separately from participant APIs. A stake must never require someone to remain in an uncomfortable meeting.

Record outbox commands and balanced ledger/state changes atomically; call the mock provider after commit. Use stable operation/idempotency keys, deduplicate verified provider events and reconcile unknown outcomes before retrying. Confirm final settlement only after every required refund/payout succeeds. Simulate failed, delayed and partially successful operations. Keep points separate. Add bounded evidence retention and redacted logs.

Document live-provider/business-model review as future work. Do not claim that naming a table escrow creates lawful custody or that a payout can be implemented as a refund to a different payer.

## K. Delivery order, tests and device verification

Use this sequence:

1. Baseline, contracts, flags and migration preparation.
2. Scenes and initial localization integration.
3. Venue suggestions in existing Date Plans.
4. Vibe media and opt-in Blind Vibe.
5. Wingman through four-person chat.
6. Daily streaks and non-cash ledger.
7. Commitment simulator and settlement UI.

Complete all scoped phases, keeping experimental behavior flagged. Keep a concise progress record with completed, tested and externally blocked items. Do not stop after a planning document or a backend-only slice.

Run appropriate existing backend build/type checks, Jest tests and real PostgreSQL/PostGIS integration tests. Run mobile typecheck/lint and meaningful component/behavior tests. Add tests where they validate actual risks:

- Scene radius boundaries, latitude/longitude order, intent/tags, expiry, stale cache, blocked/hidden users, deterministic pagination and transaction races.
- Venue authorization, selected-venue privacy, no reviewed results, closed venues and coordinate edge cases.
- Media zero/invalid/exactly-five/over-five durations, longer secondary tracks, object ownership, processing timeout and publishing policy.
- Blind progress at 0/5/10, non-finite/out-of-range input, one-sided spam, duplicate events and original-image/placeholder/cache leaks.
- Wingman concurrent acceptance, duplicate votes/matches, changed Scene versions, four-member authorization, block/leave and solo chat regressions.
- Streak first day, repeated same day, gap, longest record, reward cap, IST midnight, future-date corruption, concurrent initialization and rollback.
- Commitment both/one/neither funded or attending, deadline races, wrong/expired/replayed QR, stale plan version, ambiguous location, duplicate jobs/events, provider timeout and partial settlement. Assert conservation of funds.

Inspect the connected mobile device and use Metro to verify live UI changes. Rebuild the development client if native modules/configuration change; Metro alone is insufficient. Exercise two-account flows and four-account Wingman, permission denial, offline/reconnect, background/resume, keyboard, small screens and large text. Do not claim phone verification if tooling or the build is unavailable; record the exact gap and continue independent verification.

Finish with the implemented behavior, file/migration list, required environment/native setup, feature-flag defaults, actual test commands/results, device evidence and remaining limitations. Separate pre-existing failures from regressions. The output must be an integrated, reviewable repository change with clear experimental boundaries.
