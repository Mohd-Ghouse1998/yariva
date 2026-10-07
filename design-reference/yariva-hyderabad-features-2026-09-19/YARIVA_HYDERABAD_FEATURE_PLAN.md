# Yariva: Hyderabad feature analysis and implementation plan

Prepared 19 September 2026. This is a proposed engineering and product plan, grounded in a static inspection of this workspace. It is not a claim that these features have been implemented, deployed, tested on a phone, or validated with Hyderabad users.

## 1. Recommendation

The overlapping prompts describe **eight features**, not three independent implementations. Consolidate them into one roadmap. The strongest initial product proposition is:

> Find someone nearby who wants the same kind of plan, then agree on a practical public place to meet.

Scenes and venue suggestions directly support that proposition. Wingman adds an alternative for people who prefer meeting with a friend. Media clips may help people express themselves. Blind Vibe and streaks are experiments; neither establishes that people will form better relationships. Money commitments are the most complex and should remain an explicitly labelled simulation in this scope.

These are product hypotheses, not evidence of market demand or uniqueness. A useful launch advantage would be a reliable, relevant local community and a higher rate of mutually wanted meetings. Shipping more features alone does not establish that advantage.

The earlier [user-needs review](/Users/mohdghouse/Documents/Aroha/research/yariva-user-needs/INITIAL_USER_NEEDS.md) raised trust, mutual relevance, reciprocity, intention and practical planning as research themes. It was a limited qualitative review, largely of public Reddit discussions; it did not establish demand for these eight features or verify Instagram/Reel trends. Scenes and venue suggestions are plausible responses to some of those themes, not proven answers.

| Feature | Potential value | Decision for this implementation plan |
| --- | --- | --- |
| Scenes | Match on current intent and availability | Build first, as an additional discovery mode; retain normal discovery |
| Midpoint venues | Reduce the effort of choosing a place | Build with Scenes and existing Date Plans; curated facts, no guarantee of safety |
| Wingman | Let people meet with a trusted friend | Build a complete four-person flow behind a flag after solo planning works |
| Five-second Vibe clip | Richer expression before meeting | Build private upload, processing and playback; pilot optional publishing policy |
| Local language and tone | Make the app feel familiar | Add throughout, with explicit critical actions and native-speaker review |
| Blind Vibe | Test conversation before photo reveal | Opt-in experiment for new introductions with server-enforced media access |
| Daily streaks | Encourage an intentional action | Optional experiment; capped non-cash rewards, no login or swipe farming |
| Commitment stake | Test whether commitment changes attendance | Mock provider and state machine only; no real collection, wallet or payouts |

The optional Vibe policy, opt-in Scenes, structured activity tags, and clear safety labels are deliberate recommendations that amend the pasted specifications. They are not existing requirements secretly inferred from the code.

## 2. What already exists in this repository

| Area | Verified foundation | Consequence |
| --- | --- | --- |
| Backend | `aroha_backend`: NestJS 11, Prisma 7, PostgreSQL, Redis, BullMQ, Socket.IO, S3-compatible storage | Extend the Nest modules and existing contracts; do not create an Express/Firebase/Supabase replacement |
| Mobile | `frontend-mobile`: Expo SDK 56, React Native 0.85, Expo Router, Zustand, Reanimated, `expo-image` | Implement React Native screens in the current app; Flutter is outside scope |
| Accounts and location | Prisma `User` and `UserProfile`; latitude/longitude are on the profile | The physical user table is `"User"`, not the assumed `users`; no existing PostGIS point was found |
| Discovery | Existing eligibility filters, curated feed, signed cursors and a 24-hour snapshot cache | Preserve filters; a 12-hour Scene cannot rely on a 24-hour cached eligibility result |
| Matching and chat | `Like`, `Pass`, two-person `Match`, one match conversation, sequenced/idempotent messages | Do not create parallel solo swipe tables; Wingman requires additional relationship and membership models |
| Date Plans | Versioned plans, accept/counter/decline/cancel, venue fields, reminders and check-ins | Add venue suggestions and commitment references to this workflow |
| Privacy | Exact plan venue visibility is gated by accepted/completed state and visibility fields | Preserve this rule; do not expose the selected private plan venue through a new DTO |
| Jobs and events | Existing default BullMQ processor and Redis event publisher | Register new job handlers; durable financial/reward work cannot depend only on transient events |
| Push notifications | Dispatcher currently logs a delivery stub | Do not claim background push delivery is operational |
| Theme | Space Grotesk headings, Inter body text, responsive tokens, charcoal/warm neutrals, restrained champagne and semantic teal | Reuse the current theme, buttons, inputs, sheets, spacing and accessibility behavior |

No Scene, Wingman, curated venue, commitment escrow or streak models were found in the inspected Prisma schema. The root and inspected app directories did not report a Git repository during this review; a future coding agent must check again and preserve files without assuming Git is available.

Important implementation references:

- `aroha_backend/prisma/schema.prisma`
- `aroha_backend/src/modules/discovery/application/discovery.services.ts`
- `aroha_backend/src/modules/date-plans/application/date-plans.service.ts`
- `aroha_backend/src/modules/date-plans/domain/date-plans.privacy.ts`
- `aroha_backend/src/modules/profiles/application/profile-photos.services.ts`
- `aroha_backend/src/modules/likes/application/likes.services.ts`
- `aroha_backend/src/jobs/queue/default-queue.processor.ts`
- `frontend-mobile/src/theme/{colors,typography,responsive}.ts`
- `frontend-mobile/src/features/safety/BlockConfirmModal.tsx`

## 3. Shared architecture and migration strategy

Use additive Prisma migrations with reviewed SQL for PostGIS, indexes, database constraints and the streak function/trigger. Reconcile real model/table names before writing DDL. Do not replace account tables or duplicate existing matches and Date Plans.

Use UUIDs consistently for new application entities; do not introduce an unrelated numeric venue ID solely because one sample prompt used `SERIAL`. Store instants as `timestamptz`, expose ISO timestamps, and use `Asia/Kolkata` explicitly for the streak calendar. Monetary amounts use integer paise with currency `INR`; points are a separate non-cash ledger.

Suggested model boundaries, with final naming following repository conventions:

| Module | Models and essential invariants |
| --- | --- |
| Scenes | `Scene`, canonical activity tags; owner, intent, text, tags, starts/ends, status and version; one active Scene per owner |
| Spatial | Geography point derived from profile coordinates; GiST index; validated coordinate ranges and freshness |
| Wingman | `WingmanParty`, membership, hashed expiring invite, per-member votes, canonical party match, group conversation membership |
| Venues | `VerifiedVenue` with review status, evidence/source, last review, availability, location and optional price/accessibility data |
| Media | `VibeMedia` with owner, private object key, audio/video kind, probed duration, processing/moderation state and rendition metadata |
| Blind Vibe | Relationship-specific consent/policy, accepted-message counters and unlock state |
| Streaks | `UserStreak`, trusted qualifying activity, immutable points entries and unique user/calendar-day award |
| Commitments | `DateCommitmentEscrow` linked to a Date Plan version, participants, payment attempts, attendance evidence, journal entries and disputes |
| Durable operations | Outbox events and deduplicated provider-event inbox where needed |

All mutations authenticate the actor from the session, authorize ownership/membership, validate runtime input, and reuse the existing error envelope. Proposed error codes include `SCENE_EXPIRED`, `PARTY_NOT_ACTIVE`, `MEDIA_NOT_READY`, `MEDIA_TOO_LONG`, `VENUE_UNAVAILABLE`, `PRESENCE_REVIEW_REQUIRED` and `COMMITMENT_STATE_CONFLICT`; adapt naming to the actual error system.

Keep client/server DTOs consistent through the existing shared-contract or generated API approach. Do not export Prisma persistence models directly to mobile. Enforce constraints in the database as well as the service. Use parameterized spatial queries, bounded pagination and rate limits. Derive actor identity, point awards, media duration, reveal progress and payment state on the server.

For migration rollout: check PostGIS availability and database privileges; add nullable fields/new tables; backfill only valid coordinates; update the existing location-write path; inspect a realistic query plan; then enable flags for a limited cohort. Missing spatial capability must be visible as an unavailable feature, not silently treated as a successful nearby query. Preserve old records and document rollback by disabling flags before removing any schema.

## 4. Scenes: intent, activity and expiry

Use a normalized `Scene` record because Wingman needs `active_scene_id` and histories need stable IDs. Expose `current_scene_status` as a DTO derived from the current active record rather than maintaining several independent copies of type/tag/expiry on `User`.

Required fields: owner, `DATING | FRIENDSHIP | CASUAL_HANG`, bounded display text, canonical activity tags, `createdAt`, `expiresAt`, status and version. Default expiry is 12 hours from server creation time. Updating a Scene must have an explicit renewal action; incidental edits must not secretly extend availability. Creating a replacement ends the previous active Scene transactionally. Expiry never deletes existing matches or conversations.

`CASUAL_HANG` means an informal social activity in this product; do not silently reinterpret it as a sexual preference or overwrite the existing `ConnectionIntent` values.

Discovery procedure:

1. Authenticate and load the current active Scene and usable location. A user with no active Scene can still use existing discovery.
2. Select eligible users with an unexpired Scene of the same type. Preserve adult eligibility, mutual preferences, blocks, hidden/paused/incognito status, moderation, account state and existing relationship exclusions.
3. Apply `ST_DWithin` at 15,000 metres using `geography(Point,4326)` and the corresponding GiST index. Longitude is the first point coordinate. Geometry in SRID 4326 uses angular units; passing `15000` to that geometry overload is wrong. [PostGIS documentation](https://postgis.net/docs/ST_DWithin.html)
4. Require a shared canonical activity tag. For free-text-only records, use normalized meaningful token overlap as a documented fallback. Ignore generic tokens such as “at”, “the” and “Hyderabad”; maintain a small reviewed alias map for activities and transliteration. Do not invent an AI similarity service for the first release.
5. Rank eligible results by activity relevance, availability and approximate distance with deterministic pagination. An empty result must not quietly widen radius or mix friendship with dating.
6. Feed mutual interest through existing matching consent. A shared Scene alone does not automatically create a match.

This structured eligibility is a deliberate improvement over arbitrary substring overlap: “coffee” and “coffees” should be reconcilable, while two plans should not match merely because both mention “at”.

Include scene/party versions and mode in cache keys; recheck expiry and eligibility when reading cached IDs. Do not build a time-dependent partial index using `now()`. Index stable columns such as status, type and expiry; enforce expiry at query time and use jobs only for cleanup.

Mobile: add a compact “Your scene” entry point and composer to Discover. Keep profile cards and primary navigation recognizable. Support expired, location-disabled, no-results, offline and retry states separately. Never display another user's precise coordinates or a map pin for their live location.

## 5. Venue suggestions and midpoint

Calculate a spherical midpoint, not the arithmetic mean of longitudes. Validate finite coordinates, handle equal points and explicitly handle antipodal inputs even though local Hyderabad users are unlikely to produce them. Keep raw coordinates and the computed midpoint on the server.

The public endpoint accepts an authorized match or plan ID; it must not accept an arbitrary pair of user IDs and expose their locations. Suggest up to three nearby, available, reviewed public venues within a configured maximum search area. Return fewer than three if that is all the trusted catalog contains.

Replace `is_safe_verified DEFAULT TRUE` with `reviewStatus = PENDING` by default. If a compatibility boolean is kept, default it to false. Record who/what reviewed the venue, when, and which facts were checked. A badge should say “Venue details reviewed” with a date, not promise that a visit is safe.

Use clearly synthetic development fixtures. Real Hyderabad venue names, coordinates, operating hours and review badges must come from checked sources or a curator; do not manufacture facts for Shadab, Roastery or any other business. Venue ads, new-opening detection and commercial ranking are outside this feature set.

A midpoint minimizes neither travel time nor transport cost automatically. Label initial suggestions as “near the midpoint”; a future route-provider integration can compare travel times with fresh user consent and provider terms.

Place candidate cards in the existing chat Date Plan flow with “Suggest this place”. Public catalog information is distinct from a selected private date venue. Do not expose a withheld plan venue through suggestions, notifications, analytics or another endpoint. Preserve `canRevealExactVenue` and the existing acceptance/version behavior.

## 6. Wingman: invitation, consensus and group access

A party row by itself is not a complete feature. The implementation needs a joining flow, discovery, member approval, mutual party matching, four-person conversation access, departure and blocking behavior.

Recommended states:

```text
PENDING -> ACTIVE (buddy explicitly accepts an unexpired invite)
PENDING -> DECLINED | EXPIRED | DISCONNECTED
ACTIVE  -> DISCONNECTED | EXPIRED
```

Map `ACTIVE` to `ACCEPTED` if that enum is retained, but use one consistent meaning across layers. A pending invite must not publish the buddy's profile. Store the random invite token hashed; bind it to the intended buddy, expiry and one-time acceptance. Do not expose account identifiers in public invite codes. Resolve simultaneous invitations with a membership reservation/constraint, not an application-only “check then insert”.

A user can participate in only one active/reserved party. Both members must consent to the active Scene/version and appearing together. Declining, leaving, blocking or expiry invalidates discovery eligibility and pending votes. An expired Scene pauses party discovery until both members consent to a renewed plan.

When Wingman mode is on, the server validates the current membership and returns paired cards only. If the party becomes unavailable, return a clear state; never silently serve solo candidates as pairs.

Recommended consensus rule: both members of party A approve B, and both members of B approve A. That is four individual approvals before one canonical `WingmanMatch` is created. Votes reference stable party membership and Scene versions. Uniqueness and a transaction protect against duplicated matches.

For the initial location rule, require every cross-party participant distance to be within 15 km. This is conservative but prevents a distant buddy from being hidden by a leader's location. Apply blocks and account eligibility across all four members. For dating, require at least one complete one-to-one pairing that satisfies both people's preferences in each potential pair: A1–B1 plus A2–B2, or A1–B2 plus A2–B1. Do not require every person to be romantically compatible with both opposing members, or disclose private preferences to explain rejection. Friendship uses its applicable preferences. Document this policy because a leader-only check is materially different.

Reuse chat presentation, transport and message behavior, but implement explicit four-person conversation membership. The current two-person `Match` must not be used as a fake group. Add a group-specific conversation model or a safely migrated subject abstraction with a database constraint that each conversation has exactly one subject. Test existing solo authorization unchanged.

Revoking membership immediately prevents new messages and socket access; historical visibility and moderation records follow an explicit retention policy. At minimum, freeze a group conversation when a party disconnects or a member blocks someone; do not leave an accidental route to contact through group chat. Initial Wingman does not include four-person cash commitments.

## 7. Vibe clips and Blind Vibe

### Vibe media

A five-second audio/video clip can help expression; it does not eliminate catfishing. Treat identity verification separately. Offer accessible audio/video alternatives and pilot the requirement behind a policy flag before making it a condition of profile publication. Existing accounts must not suddenly become unpublished during migration.

Extend the current initiate-upload/finalize flow with private object ownership and processing states:

```text
UPLOADING -> PROCESSING -> READY
                      -> REJECTED | FAILED
READY -> REMOVED
```

On finalize, independently inspect the owned object in a bounded worker using ffprobe or equivalent decoder tooling. Validate file signature, allowed format/codec, byte size, dimensions, stream count and finite positive duration. Reject media with any playable audio/video content exceeding 5.0 seconds; missing, contradictory or undecodable timing information must not pass. Re-probe a generated rendition before marking it ready. Client metadata is a hint, never authoritative. [ffprobe documentation](https://ffmpeg.org/ffprobe.html)

Do not fetch arbitrary `vibe_check_url` values: this creates ownership and server-side request risks. Store private object keys plus validated metadata; return short-lived authorized media URLs as a DTO. Invoke processes with argument arrays, resource/time limits and cleanup, not interpolated shell strings.

The backend profile-publish gate must check `READY` state when the requirement flag applies. Mobile needs upload/processing/rejection/retry UI as well as playback. Use Expo SDK 56-compatible audio/video packages, stop playback on navigation/background, and provide accessible play/pause, duration and progress. Native dependency changes may require a development-client rebuild; Metro hot reload alone does not verify them. [Expo audio](https://docs.expo.dev/versions/v56.0.0/sdk/audio/), [Expo video](https://docs.expo.dev/versions/v56.0.0/sdk/video/)

### Blind Vibe

Use the requested visual formula:

```text
progress = clamp(serverInteractionCount, 0, 10)
blurRadius = isBlindVibeActive ? 20 * (1 - progress / 10) : 0
```

Treat non-finite/invalid progress as zero. The global setting expresses preference; server-side consent and the relationship's policy determine actual access. Turning a local switch off must not reveal a partner who has not consented.

Recommended counting policy: `min(validMessagesFromA, 5) + min(validMessagesFromB, 5)`. Only persisted, eligible human-authored messages count; exclude system events, typing, read receipts, duplicate retries and spam. This still needs behavioral testing: ten messages do not prove a meaningful interaction.

A normal view cannot Gaussian-blur arbitrary React children. Implement `VibeBlurContainer` with an explicit protected image source or a controlled image slot and separate unblurred children for controls. `expo-image` supports image blur, but blur is not applied to placeholders, so placeholders require their own safe handling. [Expo Image](https://docs.expo.dev/versions/v56.0.0/sdk/image/)

Client blur is only a visual effect. If the feature promises withheld identity imagery, the server must withhold original URLs and send a blurred derivative until authorized reveal. Prevent leaks from thumbnails, caches, prefetch, avatars, profile endpoints, shared cards and video. Start with **new opt-in blind introductions**; do not claim to hide photos already viewed. Under a blind policy, offer audio only or jointly authorize a video/photo reveal. Cache and offline access must not bypass the relationship policy.

## 8. Localization and Daily Social Streak

### Localization

Separate language choice from an optional Hyderabad casual tone. Introduce stable message keys with English fallback and interpolation; do not implement arbitrary global string replacement.

Preserve the requested strings as draft copy:

| Key | Requested draft | Recommended use |
| --- | --- | --- |
| `discovery.empty.casual` | Scene light undi right now, change your spot! | Casual variant for a genuine empty result only; prefer a less pushy “Try another scene” after native review |
| `safety.block.casualCandidate` | Baigan mein mila do | Candidate secondary copy only; primary action and confirmation still explicitly say “Block user” |
| `datePlan.invite.casual` | Kya bolte, scene kya hai? | Optional invitation text with a clear action label |

These are mixed conversational drafts, not verified Telugu translations. Get Hyderabad-native review before enabling them broadly. Keep consent, reporting, permission requests, payment/refund status and destructive actions unambiguous. Test larger fonts, long translations and screen-reader labels.

### Streaks

Fix the first-award bug: `last_activity_date DEFAULT CURRENT_DATE` causes the first call to look already rewarded. New users need `lastActivityDate = NULL`, current/longest zero and points zero.

Proposed qualifying action for the first experiment: a successful, eligible Scene publication initiated by the user. The backend emits a trusted event after validation. One award per IST day; no points for app opens, swipes, background renewals, repeated edits or message volume. Rate limits and moderation remain applicable. Points are cosmetic and non-transferable, with no redemption or cash conversion in this scope.

| Situation | New current streak | Points granted |
| --- | --- | --- |
| First qualifying day | 1 | 10 |
| Same IST date | Unchanged | 0 |
| Last activity was yesterday | Previous + 1 | `min(10 * newStreak, 50)` |
| Gap of at least one calendar day | 1 | 10 |
| Stored last date is in the future | No award; surface integrity anomaly | 0 |

Always set `longestStreak = greatest(previousLongest, newCurrent)`, including first activity and reset. Awards are 10, 20, 30, 40, 50, 50…; this is capped linear growth, not compound interest. When a user returns after a gap without completing an action, derive the displayed current streak as zero rather than showing a stale streak indefinitely.

Capture server time once in the transaction and compute `(timestamp AT TIME ZONE 'Asia/Kolkata')::date`. Award synchronously with the trusted activity so delayed job ordering cannot retroactively alter calendar rewards; retries carry the same activity ID. Do not rely on the database connection's `CURRENT_DATE` timezone. [PostgreSQL date/time documentation](https://www.postgresql.org/docs/current/functions-datetime.html)

Preserve `increment_user_streak(target_user_id UUID)` as a backend-only function if useful. A trigger on insertion of a trusted activity can invoke it; arbitrary profile changes and raw message inserts must not do so. In one caller transaction, initialize the streak row safely, lock it, deduplicate the source activity and user/day award, insert the points entry, update the summary, and return JSON containing streaks, balance, date and awarded points. Rollback must undo all of these together.

Prefer restricted-role `SECURITY INVOKER`. If a definer function is necessary, schema-qualify objects, set a trusted search path and revoke public execution, granting only the intended backend role in the same migration transaction. PostgreSQL grants new functions public execution by default. A PL/pgSQL `BEGIN` block is not a separate transaction; do not place `COMMIT` in an ordinary function. [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html)

## 9. Commitment stake: mock architecture and complete outcomes

This scope implements a deterministic **mock** payment provider and simulator. A database table named “escrow” is not a custody service. A live version would require an appropriate provider arrangement and assessment of the actual collection, refund, payout and wallet model. The RBI's payment-aggregator framework is relevant context, not proof that this particular product is authorized or prohibited. [RBI Payment Aggregator Directions, 2025](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896)

This is an attendance-commitment experiment, not a general solution to ghosting. It cannot establish interest, require a reply, or oblige someone to continue an uncomfortable date. A safe cancellation/exit path must remain available. Introducing money also creates operational and dispute work; it is not recommended as Yariva's initial reason to join.

Bind a commitment to an accepted two-person Date Plan and its exact proposal version, participants, venue, target time, agreed terms and currency. Default simulated stake is 9,900 paise **per person**. A plan counteroffer/reschedule must invalidate the old attendance challenge and trigger a defined cancellation/reagreement policy; money terms cannot silently move with the plan.

Separate three kinds of state:

```text
Participant funding: UNFUNDED -> PENDING -> CAPTURED -> REFUND_PENDING -> REFUNDED
                     \-> FAILED / CANCELLED; record uncertain attempts for reconciliation
Participant attendance: EXPECTED -> CHECKED_IN | NO_SHOW_CANDIDATE | REVIEW_REQUIRED
Commitment: AWAITING_FUNDS -> HELD -> SETTLING -> SETTLED
                         \-> CANCELLED / DISPUTED / REVIEW_REQUIRED
Settlement outcome: REFUNDED_BOTH | COMPENSATED_A | COMPENSATED_B | CANCELLED_REFUNDED
```

Keep outcome separate from execution: “refund requested” must not be displayed as “refunded”. `HELD` requires two confirmed mock captures. Preserve the original status names in DTO compatibility if needed, but do not let their narrow enum hide pending, partial or failed operations.

| Verified outcome | Mock settlement policy |
| --- | --- |
| Both attend | Refund each person's own 9,900 paise |
| Only A attends; B's no-show is finalized under the agreed policy | Refund A's own 9,900 and compensate A with B's 9,900; total 19,800, no fabricated additional funds |
| Only B attends | Symmetric outcome for B |
| Neither attends | Review; never award an arbitrary recipient. Explicit mock cancellation resolution refunds both |
| Only one person funds before funding deadline | Cancel and refund the payer |
| Venue closes, safety cancellation, disputed GPS/network failure or conflicting evidence | Pause settlement for review; provide a clear cancellation/refund resolution |
| Reschedule/counteroffer | Cancel/refund the old commitment in the initial implementation; new consent creates a new version |

A payment refund returns money to its original payer. Compensation to another participant is a distinct payout operation; model them separately even in a mock. A displayed “virtual wallet” is only a labelled simulation ledger here. Vibe points never share that ledger.

`verifyVenuePresence(userId, dateId, venueQrPayload)` must authenticate plan membership and verify a server-signed, short-lived challenge bound to the venue and commitment version. Validate issuer/key ID, timestamp, expiry and replay scope. A single static venue ID is insufficient. Bind replay protection to the participant/challenge so one attendee does not consume a valid shared challenge for everyone.

Check attendance within an agreed time window and geofence using fresh coordinates and bounded reported accuracy. Client GPS and QR possession are imperfect evidence; neither guarantees physical presence. A missing permission or ambiguous location leads to retry/review, not an immediate forfeiture. Do not reuse the current self-reported Date Plan “ARRIVED” check-in as verified evidence. Retain only the evidence needed for a bounded dispute period.

At target time plus 30 minutes, a durable job evaluates eligibility for no-show resolution, not a browser timer. A periodic reconciliation sweep catches missed/delayed jobs; a delayed job is not guaranteed to execute at its exact requested time. Define the exact deadline once; serialize timeout and check-in with the same row lock/version so only one valid transition wins. The simulator may finalize an undisputed no-show and enqueue the specified compensation; real-world disputed cases must remain reviewable. [BullMQ delayed jobs](https://docs.bullmq.io/guide/jobs/delayed)

Persist state transitions, balanced journal entries and outbox commands in one transaction. Perform provider calls after commit with stable operation IDs/idempotency keys. Deduplicate signed provider events; retry uncertain calls using the same key and reconcile before making another transfer. Mark an outcome settled only when all required mock refund/payout operations have confirmed success. Test partial success, duplicated callbacks and crashes between confirmation and local persistence.

## 10. Delivery sequence and proof required

Proposed API surfaces below are illustrative; use the existing route prefixes and contract conventions during implementation:

| Area | Commands and reads |
| --- | --- |
| Scenes | Create/end current Scene; get own Scene; discover by mode with a signed cursor |
| Venues | Get suggestions for an authorized match/plan; select a candidate through existing Date Plan creation/counteroffer |
| Media | Initiate upload; finalize owned upload; read processing status; remove/replace owned Vibe media |
| Wingman | Create invitation; accept/decline; get current party; leave; discover parties; vote; list/read authorized group conversations |
| Blind Vibe | Read effective relationship reveal state; submit consent preference; derive progress from accepted messages |
| Streak | Read own summary/history; award through trusted activity only, with no public increment endpoint |
| Commitment | Create/agree/fund mock commitment; issue/verify attendance challenge; inspect settlement; cancel/dispute; restricted mock review resolution |

Return explicit loading/pending/error states for asynchronous operations. Media processing and settlement need status reads after reconnect, not only a one-time success toast. Keep administrative venue review and mock dispute resolution behind separate authorization from normal participants.

| Phase | Deliverable | Gate before expansion |
| --- | --- | --- |
| 0 | Baseline checks, contract/error conventions, flags, migration and privacy decisions | Existing failures recorded separately; baseline solo flow understood |
| 1 | Scenes vertical slice, spatial queries and initial localization keys | Radius/expiry/privacy tests; two accounts can discover and mutually connect |
| 2 | Curated venue suggestions integrated into Date Plans | Consent and exact-venue privacy preserved; expired/closed/no-result cases work |
| 3 | Vibe upload/processing/playback; opt-in Blind Vibe | Server duration tests; no image leakage; real-device playback and lifecycle checks |
| 4 | Wingman invite through four-person chat | Four accounts; all consent, block/leave and concurrent match tests pass |
| 5 | Streak activity trigger and non-cash points ledger | First-day, IST boundary and concurrent duplicate-award tests pass |
| 6 | Commitment simulator with QR/presence and settlement UI | Full outcome matrix and crash/retry tests; real provider paths disabled |

Implement each phase end to end before moving on: migration, typed backend, authorization, jobs/events, mobile UI and verification. All phases are covered by the companion prompt; prioritizing delivery does not silently delete the later features.

Test the database behavior on actual PostgreSQL with PostGIS, not only mocked repositories. Cover 14.9/15/15.1 km boundaries, lon/lat ordering, stale location, same/different intent, exact expiry, cached expired candidates, blocked/hidden users, and SQL parameterization. Inspect query plans on a representative synthetic dataset before claiming scale.

Media tests include 0 seconds, valid sub-five-second media, exactly five, longer audio track than video, malformed duration, unauthorized object ownership, decoder timeout and rejected moderation. Blind tests include counts 0/5/10/out-of-range/NaN, duplicate messages, one-sided spam and original-URL leakage.

Streak tests include initialization, repeated calls, gap resets, longest streak, the 50-point cap, 23:59/00:00 IST, future-date corruption, concurrent initial insert, repeated source events and rollback. Commitment tests include both/one/neither funded or present, early/late/expired/replayed QR, wrong membership, stale plan version, provider timeout, partial settlement, duplicate jobs/events and balanced funds.

Run repository backend build/type checks and focused Jest/integration tests; run mobile typecheck/lint and meaningful Vitest tests. Then inspect the connected phone using Metro and available device tooling. Test small screens, large text, keyboard, safe areas, slow/offline network, permission denial, background/resume and light/dark themes. Use two accounts/devices where possible and four test accounts for Wingman. A successful Metro bundle is not evidence that the interaction works. If a device/build cannot be exercised, record exactly what remains unverified.

## 11. Product validation before broad rollout

Start with one sufficiently dense Hyderabad pilot community rather than diluting discovery across every locality and intent. Interview intended users about their last failed attempt to arrange a meeting before showing feature descriptions. Test whether they prefer solo Scenes, a friend-assisted meeting or ordinary matching. These interviews have not been conducted for this report.

Measure the journey with consent-conscious, minimal analytics: eligible Scene sessions → reciprocal conversations → mutually accepted plans → optional post-meeting feedback. Inspect time to a suitable plan, venue rejection reasons, invitation acceptance, media completion/drop-off, reports/blocks and cohort return rates. Do not equate screen time, streak length or a QR scan with a good relationship.

Feature flags should allow separate evaluation of mandatory media, Blind Vibe, Wingman and streaks. Venue review freshness, local catalog coverage and actual participant density are operational requirements that source code alone cannot provide. Keep real payments off. Decide which experiments deserve a public launch from observed local outcomes, not from the number of modules completed.

## 12. Reconciliation with earlier discussions

The eight-feature prompt covers the latest collected specifications. It does **not** include every concept discussed earlier. This comparison records scope; it does not authorize adding the backlog to the implementation prompt automatically.

Earlier references reviewed include the [market strategy](/Users/mohdghouse/Documents/Aroha/research/yariva-market-research/yariva-market-strategy.md), [three-module engineering brief](/Users/mohdghouse/Documents/Aroha/research/yariva-feature-proposal-review/REVISED_ENGINEERING_BRIEF.md), [product feature map](/Users/mohdghouse/Documents/Aroha/design-reference/yariva-redesign-brief-2026-09-13/YARIVA_FEATURE_MAP.md), older product/implementation notes and the concepts pasted in this conversation. Historical documents describe their inspection dates; they are not fresh proof of current runtime behavior.

| Earlier idea | Relationship to the current eight-feature plan |
| --- | --- |
| Active Broadcast Stories: 24-hour media, avatar rings and action stickers | Scenes covers short-lived activity/intent availability, with a 12-hour default. The media story feed, fullscreen viewer and sticker responses are **not included**. A story's media lifetime and actual availability deadline would need separate rules. |
| Double Date / Split Mode | Included as Wingman: buddy invitation, paired discovery, four approvals and four-person chat. Group calls and a complete four-person Date Plan flow are not included. |
| Two Truths & a Blind Lie | **Not included** in the eight-feature prompt. The earlier brief recommends an optional game in chat, with a synchronized timer only if both people opt in. This is different from blurred-photo Blind Vibe. |
| Friendship / Social Side-Quest toggle | Friendship and informal-hangout intent are included in Scenes. A full community destination, open groups and event hosting are not included. |
| Third Place Radar: public hangouts and people currently there | Public venue suggestions cover part of place discovery. A map showing people currently at places is **not included**. |
| Micro-Squads of four or five strangers | **Not included**. Wingman connects two existing friends with another pair; it does not form new interest-based squads. The proposed 72-hour chat deletion is not part of this plan. |
| Group Broadcasts from two or three friends | **Not included**. A Wingman party does not automatically create a public group broadcast. |
| Daily Anti-Curated Reality Check videos | **Not included**. A reusable profile Vibe clip is different from a required daily video or public posting feed. |
| Date Spots with cafés, restaurants, parks and other public meeting places | A small reviewed catalog, up to three midpoint suggestions and Date Plan integration are included. Full joint shortlists, advanced budget/atmosphere filters, sourced ratings, route-based travel estimates and reservations are not all specified in this first version. |
| New café openings, offers and venue advertisements | **Not included**. Later work would need sourced opening dates, venue submissions/review, advertising labels and notification controls. |
| Date Ready for overlapping availability during the coming week | Scenes covers temporary readiness and activity intent. Weekly availability matching and the fuller shared-planning experience remain separate extensions. |
| Earlier voice-introduction idea | Included through the five-second Vibe media feature. |
| Earlier selfie/photo verification idea | **Not included** as a new identity-verification workflow. Vibe clips do not replace it. |
| Earlier strict daily discovery cap, prompt-of-the-day and save-for-later ideas | **Not included** in this prompt. Existing curated discovery remains; a cached batch is not the same as a new enforced daily quota. |
| Premium v3 design foundation and Yariva branding | Preserve the current brand, fonts, components and responsive foundation while integrating new screens. A fresh logo or whole-app redesign is not part of these feature modules. |

Existing solo discovery, mutual matches, chat, Date Plan proposals/responses, blocking/reporting and private post-date responses are foundations to preserve and verify. They should not be counted as newly invented features merely because the new modules use them. Implementation and public rollout remain separate decisions, especially for Blind Vibe, streaks and simulated stakes.
