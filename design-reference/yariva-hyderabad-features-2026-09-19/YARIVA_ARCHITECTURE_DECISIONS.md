# Yariva architecture decisions

Last reconciled: 29 September 2026 (Phase 6 and private-recap polish).

## Implemented foundation

### ADR-01 — Scenes stay inside the modular monolith

`src/modules/scenes` owns Scene rules, persistence, authorization and discovery. The API uses typed DTOs and the mobile app consumes those contracts through `src/api/endpoints/scenes.ts`; no client-authored expiry, distance or eligibility decision is trusted.

### ADR-02 — Spatial migration is additive and longitude-first

`UserProfile.locationLat/locationLng` remain the application write contract. The database maintains `locationPoint geography(Point,4326)` with a `SECURITY INVOKER` trigger using `ST_MakePoint(longitude, latitude)`. The migration installs PostGIS, backfills only valid coordinate pairs, gives legacy valid coordinates an honest `locationUpdatedAt` fallback, and creates a GiST index. Invalid/null pairs produce a null point. Scene radius is enforced with `ST_DWithin` at an inclusive 15,000 metres.

### ADR-03 — One current Scene is an explicit state invariant

A partial unique index permits one `ACTIVE` Scene per owner and contains no volatile time predicate. Server code takes a per-owner advisory transaction lock, marks expired/replaced state explicitly, and creates a 12-hour expiry. Renewal creates a new row/version in the same lineage. Availability must be ordered and inside the Scene lifetime.

### ADR-04 — Scene discovery never broadens silently

Candidates require the same Scene intent plus canonical activity equality or a meaningful normalized-token overlap. Both complete windows must overlap; a missing window is returned as `UNCONFIRMED`. Adult/profile state, mutual age/gender preferences, visibility, moderation/account state, blocks, existing matches, location freshness and the 15 km limit are enforced on the server. Results expose only coarse locality/rounded distance. Pagination is deterministic by distance, creation time and Scene id.

Redis keys include mode, viewer Scene id/version and a global Scene generation. Scene mutations bump the generation. Cache hits contain ids only and every id is re-read through the full eligibility query, so stale cache data cannot restore a blocked, hidden, expired or moved candidate.

### ADR-05 — Rollout and configuration are server-owned

`scenes.v1` defaults off in the migration and is enabled only by local/demo seed or an admin rollout. The authenticated capabilities route exposes safe radius/lifetime values to mobile. Secrets never enter the feature-flag payload.

| Setting | Owner | Default | Purpose |
| --- | --- | --- | --- |
| `scenes.v1` | database feature flag | off in migration | Scene UI/API rollout |
| `SCENE_LIFETIME_HOURS` | backend environment | 12 | server-created expiry |
| `SCENE_RADIUS_METERS` | backend environment | 15000, max 15000 | spatial eligibility |
| `SCENE_LOCATION_MAX_AGE_HOURS` | backend environment | 168 | recent-location requirement |
| `SCENE_DISCOVERY_CACHE_SECONDS` | backend environment | 120 | bounded id-cache lifetime |
| FCM/APNs credential variables | backend secret environment | unset | real native push transport |
| language/tone | mobile local preference | device language / standard | presentation only; never authorization |

### ADR-06 — Push delivery is durable per notification/token

Native APNs/FCM tokens retain their provider. Mobile requests notification permission only when the user enables a push preference; app boot only re-syncs an already-granted permission. Backend transports use FCM HTTP v1 or APNs token authentication, honor match/message/call preferences, invalidate provider-rejected tokens and persist one `PushDelivery` per notification/token. BullMQ retries transport failures; already-sent token rows are skipped on retry. Missing credentials remain a failed/unverified transport, never a fake delivery.

### ADR-07 — Localization and Hyderabad tone are independent

Stable JSON keys have English fallback and interpolation. Language (`en`, `hi`, initial `te`) and optional `hyderabad-casual` tone are separate settings. Casual alternatives apply only where a matching key exists. Primary block/report/consent/safety/permission wording remains explicit; slang may appear only as secondary explanatory copy. Hindi/Telugu/mixed Hyderabad copy requires native-speaker review before public rollout.

### ADR-08 — Solo meetups stay casual and chat-first

The existing versioned Date Plan remains the consent record, but the product surface asks only for a quick time and public place. Tonight, Tomorrow, Weekend and custom time cover the scheduling need. The other participant accepts or counters with another time/place; a counter resets prior acceptance. Shared availability records, budget ranges, overlap summaries and shared shortlists were removed rather than retained as a parallel planning engine.

### ADR-09 — Reviewed catalog plus universal Maps handoff

`ReviewedVenue` owns review provenance, operational status, optional sourced rating/review count and a coarse `CAFE | RESTAURANT | ACTIVITY | OTHER` category. Search is participant-authorized and supports category plus name/address/locality text. It defaults to a privately calculated geographic midpoint, can use only the authenticated actor's location for Near me, or can filter a typed public area without participant coordinates. Eligible results rank by rating, review volume and then internal proximity. The response never exposes origins or midpoint; rounded distance is returned only for actor-selected Near me results. The proposed public venue is visible to both participants before acceptance so consent is informed. Universal Google Maps URLs provide the external map/search handoff without an API key; live Places data remains a separately credentialed future integration and is never fabricated.

### ADR-10 — Deposits and payment simulation are removed

Casual meetup planning has no budget, deposit, escrow, payout, refund or mock-money state. The superseded Phase 7 simulator is not an implementation target and is not counted as a completed feature. A future money feature would require a new explicit product, legal, provider and trust/safety decision.

## Reserved decisions for later authorized phases

### ADR-11 — Duo history and public-place consent

Duo conversations have a unique pair-match subject and exactly four immutable member snapshots, separate from solo matches. Block, departure, or membership-version change closes the old conversation and cancels open group plans; no participant may fetch old group messages or attachments afterward. History remains retained for moderation. Party advisory locks precede conversation/plan row locks, and writes recheck authorization inside the transaction. Message media is fetched through an authenticated, no-store endpoint rather than a transferable signed download URL. Previously received bytes cannot be recalled.

Group venue search reuses the reviewed solo catalog. Its default internal center is the equal-weight spherical centroid of all four fresh locations, independent of party order. If any location is missing/stale, use Near me or a typed public area; never silently average fewer people. Neither participant coordinates nor the group center/distance are returned. Group proposals keep immutable revision snapshots and request IDs. All four must accept one version; a counter starts a new version with only its proposer accepted. Any participant can decline or cancel. There are no deposits, bookings, group calls, or private cross-Duo direct messages.

- Effective photo disclosure will be server-derived from relationship/event state and applied to every rendition/cache path. No client toggle may reveal media.
- Sunday reports will use the specified Sunday 20:00 IST half-open interval and unique user/period/version identity. Rewards will use an immutable ledger plus atomic summary update.

These reservations document compatibility boundaries only. Completion evidence remains in the single tracker. Phase 7 was removed by ADR-10.

### ADR-12 — Blind introductions cannot undo previous disclosure

Only an eligible event enrollment with explicit blind consent plus mutual interest creates a new Blind relationship. The persisted policy defaults to five unique texts each, with a ten-second per-sender qualifying interval; normalized repeated content, retry IDs, edits, deletes and attachments do not award progress. PostgreSQL serializes contributions and retains immutable contribution history. Either both users consent to early reveal or both capped counts reach their target. No event ending or local toggle reveals photos.

Every public profile/Scene/avatar/Duo mapper and Vibe access uses a shared disclosure gate. Before reveal, the server returns an identity-free protected image slot, not an original or a weakly blurred identifiable image; mobile renders a sharp lock treatment. Video Vibes are unavailable until reveal; optional voice calls remain available. Visual calls and attachments cannot bypass this policy. Disclosed URL issuance is recorded conservatively under the same pair lock used for introduction. Two accounts predating exposure tracking cannot become a blind pair because historical cache exposure cannot be proved absent; a new account paired with a legacy account is eligible if neither direction has since issued media. Ordinary discovery is unchanged and may make a pair ineligible for Blind Vibe.

Occurrences persist UTC boundaries and derive effective state from server time even when a worker is delayed. Defaults are Thursday 20:00–22:00 IST; validated environment policy and admin-only overrides own scheduling. Event-row locking serializes join, leave, cancellation and mutual introduction; pair locking coordinates blocks and media issuance. Ending closes new introductions but preserves existing chats and reveal policy. A recurring idempotent worker persists states and deduplicates notifications only for opted-in enrollments. Actual APNs/FCM receipt remains separately credential-blocked. Pilot rollout uses the existing user allowlist flag.

### ADR-13 — Private activity facts, controlled recap rollout and manual exports

Only a valid user-initiated Scene publication/manual renewal records trusted activity in the publication transaction. The database captures server IST day, binds the fact to the transaction/source and locks the user summary before awarding once per day. Ledger and qualifying/first-acceptance facts are immutable; no public award route exists. Scene edits, app opens, messages, report reads and shares never award points. Points are non-cash/non-transferable. Missing days expire the displayed current streak, not accumulated points or the longest record; future dates surface an integrity anomaly rather than award.

Report version 1 snapshots the latest closed Sunday-20:00-IST half-open interval under a per-user lock and unique user/period/version key. It counts actual Scene publications, first accepted solo/Duo plans, rewarded activity days and ledger points; acceptance is not attendance. History begins at the later of migration rollout or account creation, without backfill. Untracked history is distinguished from measured zero; partial periods are labelled. The application reuses persisted snapshots rather than rewriting them on repeat requests.

Soft deletion, cancellation, blocks or later moderation do not subtract valid historical non-identifying counts or rewrite ledger facts. Auth/account eligibility gates future access; reconciliation selects active non-deleted opted-in accounts. Facts do not store another person's display name, chat, photo or precise location. Immutable facts/FKs mean a production account-erasure/purge workflow needs an explicit audited retention decision; no automatic hard-delete or regulatory retention sign-off is claimed here.

`activity.v1` defaults off and uses the existing server-owned rollout mechanism. Local verification enables only Chinmoy's repository test account. Disabling it hides the Profile entry, denies recap reads, skips reconciliation and cancels queued recap push at dispatch. Trusted publication facts continue recording after the additive migration even when display rollout is off; the flag is a presentation/report rollout, not an erasure or reward-reset switch. Do not disable by dropping tables or rewriting history. Streak display is optional; recap notifications default off. Enabling notifications reuses native permission/token registration, saves only after registration succeeds and never reports denial as successful consent. Dispatch rechecks both preference and flag; missing provider credentials remain unverified delivery.

The private screen and manual centered preview reuse shared semantic colors, Inter/Space Grotesk and original brand geometry. The same SVG is used for preview and explicit 1080×1920 PNG rendering, with 96px safe margins. Export metrics are excluded by default on every preview opening and are available only by deliberate selection with tracked history. The share model allowlists period/copy/selected counts, never account IDs/tokens/URLs/photos or other people. Generated PNG dimensions are checked before writing. Files live only in the dedicated app-private `yariva-recap-exports` cache, with account-neutral timestamp names; only matching generated files older than 24h are pruned on the next recap visit/export, not by a guaranteed background deadline. Files are not deleted immediately after chooser dismissal because receiving apps may read asynchronously. Platform sharing is manual, not direct Instagram integration or proof of publication.

Native `expo-sharing` requires the rebuilt development client; Metro alone does not install it. On 29 September the user approved recap-PNG generation only, not screenshots/recordings. Actual export inspection found nested SVG viewport clipping/misplacing brand and footer; a single root SVG with transformed original paths fixes it. The corrected 1080×1920 neutral PNG and native chooser were verified without selecting a receiving app or claiming publication. Tracked-zero/nonzero/native selected-metrics/iOS export checks remain separate unfinished device QA. No arbitrary stats were forced into the signed-in account.

The entry is now called Weekly recap, not a Snap/story feed. It is private-first: compact period/status/current activity, exact cutoff/reward facts behind an info action, preferences behind one gear. Sharing is secondary and absent for an untracked period; measured low/zero periods are still truthful tracked recaps. Preview has fixed Share/Close controls and a height-budgeted 9:16 card; no disabled empty-history metrics toggle. Shared CenterDialog/BottomSheet respect the system reduced-motion preference and runtime changes, including cancellation of an old sheet animation during rapid visibility changes.

SDK56 patch packages were aligned with the installed Expo compatibility map (no SDK-major/framework change), and the updated Android arm64 client rebuilt/installed while preserving sign-in. Metro was necessarily restarted for changed dependencies. Two high-severity transitive audit findings were removed by within-range updates; one Metro image-size high and 18 moderate npm-audit findings remain for controlled review, not a clean-security claim or forced major override. New recap strings use English fallback; native Hindi/Telugu review remains required.
