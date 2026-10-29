# Yariva full-stack implementation prompt — UI/UX first

Updated 23 September 2026: Phase 2 was simplified after live product review. Solo meetups are now a quick, chat-first time-and-place flow; shared availability forms, budget matching, candidate shortlists and the commitment/deposit simulator were removed from scope. The filename is retained so existing links continue to work.

---

Act as Yariva's Principal Full-Stack Engineer and Lead Mobile Product Designer. Implement the features below in my existing backend and React Native app. **The quality of the UI/UX is a primary acceptance criterion, alongside correct backend behavior.** Deliver a coherent, polished product for adults seeking dates or friendship in Hyderabad, rather than isolated demos.

Edit actual repository files. Work in phased, complete vertical slices: migrations, domain services, API contracts, mobile screens, asynchronous jobs, tests and physical-device verification. Do not stop after producing a plan, mock screens, disconnected components or illustrative code blocks. Continue through the authorized scope while preserving existing data and working behavior.

Make sensible implementation decisions and document them. Ask only when a missing external credential, genuinely consequential product decision or destructive operation prevents progress; continue independent work where possible. Never fabricate operational integrations, venue partnerships, payment success or test evidence.

### Token and credit efficiency — mandatory workflow

Reduce avoidable context, output and repeated work while completing the authorized scope. This is an efficiency policy, not permission to omit features, weaken security, skip necessary tests or claim unverified UI works. It cannot guarantee a credit reduction or enforce a provider's billing limit.

- **Read selectively.** Read this specification once, retain its common constraints, then revisit only the active feature and relevant requirements. Use `rg`/file inventories and targeted symbol/line reads before opening large files. Exclude dependencies, generated output, build folders and historical reports unless needed. Inspect relevant callers/contracts before changing behavior; do not guess to save a read.
- **Avoid repetitive investigation.** Maintain a short map of discovered modules, reusable components, scripts and decisions. Reuse verified findings until code or requirements change. Prefer the existing architecture and one justified approach over repeatedly generating alternatives. Consult current primary documentation when needed, without repeating the same lookup unnecessarily.
- **Keep tool output bounded.** Return relevant matches, failure excerpts, exit status and concise result summaries. Keep necessary full logs available locally with secrets redacted; do not print entire files, lockfiles, successful build logs, dependency trees, images encoded as text or enormous stack traces into the conversation. Increase output when the truncated context is needed to diagnose a failure.
- **Make focused edits.** Patch the smallest coherent set of files and reuse established helpers/components. Avoid rewriting unchanged files, unrelated cleanup, speculative abstractions, repeated scaffolding or generating multiple implementations that will be discarded. Keep code readable; minifying source is not a useful substitute for reducing unnecessary work.
- **Batch independent work.** Group independent searches and reads and inspect every result. Keep dependent edits, migrations and state-changing operations sequential where necessary. Reuse the existing Metro/build/test sessions instead of repeatedly restarting or polling unchanged processes. Do not spawn duplicate agents or extra model reviews unless explicitly authorized and useful for a bounded independent task.
- **Verify incrementally.** Establish a relevant baseline once, run focused tests after changes, then run the required broader checks at integration/completion. Repeat broad suites when shared code/contracts change, failures arise or an unresolved concern requires it. Reuse a passing result only while its tested code/dependencies remain unchanged. Keep all required concurrency, authorization, migration and device checks.
- **Keep visual QA deliberate.** Inspect before/after screens and the changed interaction states on the real device. Reuse valid baseline evidence; avoid repeated unchanged screenshots or capturing every animation frame. Do not replace visual verification with a compile check to save tokens.
- **Communicate briefly.** Give short progress updates about findings, decisions and blockers. Do not repeat this prompt, the entire roadmap or large code blocks already written to files. Link to artifacts and report actual changes/results. Expand only when needed to explain a consequential decision or failure.
- **Checkpoint for continuation.** Use the existing `YARIVA_IMPLEMENTATION_PROGRESS.md` alongside this prompt as the single tracker. Keep its top checkpoint short (preferably under 500 words); detailed task checkboxes and linked evidence may extend beyond that. Read the checkpoint and relevant phase first, then verify changed files before rescanning the repository. Update it after each meaningful completed task, at phase boundaries and before a handoff. Preserve existing entries and distinguish planning from verified implementation.
- **Respect explicit budgets and settings.** If the user supplies a phase limit or token/spend budget, work within the available controls and leave an accurate checkpoint when reached. Do not invent a budget, change model/account settings, purchase credits or claim exact usage that the environment does not expose. If usage is unavailable, say so. Otherwise continue the approved phases; efficiency alone is not a reason to stop early or repeatedly ask permission.

Use the shortest complete final handoff that preserves the evidence and limitations required below. Cost reduction comes from avoiding unnecessary work, not from quietly shrinking the task.

### Persistent task tracking — mandatory workflow

Tracker: [YARIVA_IMPLEMENTATION_PROGRESS.md](/Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_IMPLEMENTATION_PROGRESS.md).

- Read and reconcile the tracker at the start of implementation and each continuation. Inspect recorded evidence and relevant changed files before assuming a previous completion is still valid. Do not reset the checklist or create a second competing TODO/status file.
- Use `[x]` only when that task's acceptance criteria are satisfied and evidence is recorded. Keep `[ ]` for pending, in-progress, blocked or unverified work, with an explicit status/reason where useful. Merely generating code, a migration or a screen does not complete its integration/device checks.
- Update the relevant task immediately after the meaningful unit of work finishes: checkbox, concise evidence (files, check command/result or observed behavior), date/validated state and exact next step. Batch the small tracker edits with that task's implementation; do not rewrite the whole file after every tool call.
- Tick a feature overview only when all its required subtasks and relevant dependencies pass. Track backend, frontend, tests and device checks separately so partial progress is visible. Keep planning completions separate and do not inflate feature counts with documentation tasks.
- If a change invalidates a checked task, untick the affected item and feature sign-off, add `NEEDS RECHECK` with the reason, and retain a trace of earlier evidence. Do not rerun or reopen unrelated completed tasks without cause.
- For unavailable credentials, devices or external dependencies, leave the affected checks unticked and record the actual blocker and required next action. A mocked test must be labelled mocked and cannot replace a required real delivery/device check.
- Keep the scope aligned with this prompt. Record agreed additions/removals explicitly; do not silently drop tasks, tick exclusions as implemented, or count simulated payments as live payments.
- Before every handoff/final response, save the tracker and briefly report task IDs completed in that run, the next pending work and actual blockers, with a link to the file. Maintain it while working; this does not imply a separate background monitor.

## 1. Existing workspace and source of truth

Workspace: `/Users/mohdghouse/Documents/Aroha`.

**Cloud continuation — 29 October 2026:** The path above identifies the original Mac checkout, not a required cloud directory. In Codex Cloud use the checked-out root of `Mohd-Ghouse1998/yariva` and resolve repository paths relative to it. Start with [the portable Events handoff](YARIVA_CLOUD_EVENTS_HANDOFF_2026-10-29.md) and [the existing tracker](YARIVA_IMPLEMENTATION_PROGRESS.md). The immediate authorized scope is tracker EVM-01–08 and section 13B's latest Events feed/nearby-places direction; do not restart the entire backlog. Local phone, database, credentials, Metro and temporary evidence do not transfer through Git. Preserve earlier work and leave unavailable acceptance checks explicitly pending.

Backend: `aroha_backend` — NestJS, TypeScript, Prisma/PostgreSQL, Redis/BullMQ, Socket.IO and S3-compatible object storage.

Mobile: `frontend-mobile` — Expo SDK 56 / React Native, Expo Router, Zustand, Reanimated and `expo-image`. Re-read installed versions and lockfiles before installing anything.

Read applicable `AGENTS.md` files and inspect current code before editing. Check Git status if available; do not assume this workspace is a Git repository. Preserve unrelated and uncommitted work. Do not substitute a Flutter, Express, Firebase, Next.js or Supabase sample application.

Inspect at least:

```text
aroha_backend/prisma/schema.prisma
aroha_backend/src/modules/discovery/
aroha_backend/src/modules/likes/
aroha_backend/src/modules/matches/
aroha_backend/src/modules/conversations/
aroha_backend/src/modules/messages/
aroha_backend/src/modules/date-plans/
aroha_backend/src/modules/profiles/application/profile-photos.services.ts
aroha_backend/src/modules/notifications/application/notifications.services.ts
aroha_backend/src/jobs/queue/default-queue.processor.ts
frontend-mobile/src/theme/
frontend-mobile/src/components/ui/
frontend-mobile/src/components/layout/
frontend-mobile/src/features/discovery/
frontend-mobile/src/features/chat/
frontend-mobile/src/features/datePlans/
frontend-mobile/src/features/safety/
```

Revalidate these known constraints: the schema uses `User` and `UserProfile`, with profile latitude/longitude fields rather than the proposed generic `users.location`. Existing solo matches/conversations represent two people. Date Plans already have versions, acceptance and exact-venue privacy rules. Discovery has a 24-hour snapshot cache. The inspected push dispatcher contains a stub and must not be treated as working external delivery.

Use this prompt for current scope and defaults. Earlier documents are rationale, not additional scope or permission to overwrite the current design:

```text
design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_HYDERABAD_FEATURE_PLAN.md
design-reference/yariva-hyderabad-features-2026-09-19/MASTER_LIST_READINESS_REVIEW_2026-09-20.md
design-reference/yariva-redesign-brief-2026-09-13/MOBILE_APP_V3_THEME_ADDENDUM.md
```

## 2. UI/UX quality contract

Build directly in the existing app. Do not create a Figma file or restart the whole interface. Preserve useful navigation and working interactions; revise them only where an observed issue or new feature requires a change.

### Visual foundation

- Preserve Space Grotesk 600 for headings and Inter for body text and controls, using the actual font registration and current typography tokens.
- Reuse current semantic colors from `frontend-mobile/src/theme/colors.ts`: the implemented Warm Human Modern warm neutral surfaces, charcoal text/actions, coral/terracotta emphasis, and semantic trust/success/error colors. The earlier champagne wording is superseded by the current tokens. Do not restart palette exploration or apply a global neon/pink/blue redesign.
- Use the `mobile_app_v3` foundation for control hierarchy, compact sizing and responsiveness. Its reference is `/Users/mohdghouse/Desktop/new/Backend/mobile_app_v3`; inspect it if available. Current Yariva tokens take precedence over the addendum's older unresolved color explorations.
- Extend existing `Button`, `Input`, `Card`, `BottomSheet`, `Screen`, `ScreenFooter`, Text and theme utilities. Do not create eight independent visual systems.
- Preserve the v3-style visual button height around 42–44 logical units with effective touch targets at least 48, as already supported by hit areas. Ensure hit areas do not overlap adjacent actions. Let controls grow for larger text rather than imposing fixed heights.
- Retain responsive gutters and width limits: inspect `responsive.ts`, including compact widths below 360 and wider layouts at 600. Use flexible layout, not screenshots scaled to a device width.
- Keep bios/chat/form content legible using the existing 15–16 body sizes where appropriate. Do not shrink essential copy or disable font scaling to fit a design.
- Use consistent radii, spacing, restrained borders/shadows, quality existing imagery and quiet motion. Avoid decorative glass panels, constant gradients, excessive badges and oversized headings that crowd out people and actions.

### Interaction foundation

- Give each screen one clear primary action. Reveal secondary options progressively. Use explicit labels such as “Post scene”, “Invite friend”, “Suggest this place” and “Join Blind Vibe”.
- Make important states visible: waiting for a buddy, waiting for the other person, processing media, expired Scene, active event, plan confirmed, settlement pending. Never communicate state through color alone.
- Preserve form input and scroll position during recoverable errors. Prevent repeated submissions and duplicate invitations. Use optimistic UI only where rollback is safe; confirmed matches, venue acceptance, funds and identity states require server truth.
- Design loading, empty, offline, denied-permission, partial-success, retry, expired and blocked states as part of each feature. Empty feeds must not invent people, activity, ratings or urgency.
- Keep one-handed actions reachable, sheets usable with the keyboard, and content clear of status/navigation bars. Respect hardware back, dismiss behavior and focus restoration.
- Add appropriate pressed feedback, subtle optional haptics, smooth transitions and reduced-motion support. Use stable media dimensions and list virtualization; inspect actual frame behavior instead of claiming performance from appearance.
- Keep voice/video playback user-initiated and stop it on navigation/background as appropriate. Provide accessible labels, focus order, contrast, dynamic text support and clear recording controls.
- Explain location, recording and notification permissions at the moment of need. Denial must have a usable fallback. Do not request unrelated permissions on the first launch.
- Avoid forced streak prompts, public popularity rankings, fabricated scarcity or interruptions intended only to inflate screen time. Measure whether people understand the flow and make mutually wanted plans.

### Information architecture

Integrate features into existing destinations rather than adding a tab for each:

| Existing surface | New behavior |
| --- | --- |
| Discover | Your Scene, relevant nearby profiles, a Wingman entry point and an optional Blind Vibe event card |
| Full Profile | Readable current Scene and a short Vibe preview, respecting photo disclosure |
| Connections/Chats | Ordinary and group matches with clear participant identity and waiting states |
| Chat/Plans | Quick meetup time, a reviewed public place or manual place, Maps handoff and a mutually accepted plan |
| Profile | Vibe recording, local-tone preference, optional streak summary and private weekly recap |

First prove the new component treatment on Discover, Full Profile, Connections, Chat and Date Plan using real running UI. Then apply the same components to event, group and recap states. Do not pause for cosmetic approval when the existing design system resolves the choice.

## 3. Shared engineering and backend requirements

- Extend Nest modules and existing authentication, errors, policies, upload, matching, moderation, analytics and feature-flag mechanisms.
- Use additive Prisma migrations with reviewed SQL for PostGIS, indexes, constraints and streak functions. Reconcile actual physical table names. Preserve existing matches, histories and profile data.
- Keep TypeScript strict, validate request bodies at runtime, and share or generate transport contracts through repository conventions. Avoid `any`, silent catches and importing Prisma persistence models into mobile.
- Derive actor identity from authentication. Check ownership/membership and blocks for API reads/writes, media access and socket subscriptions. Keep participant coordinates, private answers and payment evidence out of ordinary logs/analytics.
- Use `timestamptz` for instants, ISO timestamps for transport, and explicit `Asia/Kolkata` rules for events/reports/rewards.
- Use parameterized queries, database uniqueness/check constraints, bounded pagination/rate limits and transactions that handle concurrent requests.
- Use durable outbox commands for operations that must survive a process crash. Register jobs in the actual worker. Treat sockets as notifications to refresh authoritative state, not as the only record of an event.
- Introduce server-enforced feature flags with documented local/test defaults and a disable path. Use clearly synthetic fixtures; hide unavailable integrations rather than pretending they work.
- Inspect existing APNS/FCM token registration and implement a real compatible push adapter with retries, invalid-token handling, notification preferences and deduplication. Do not send one provider's token format to another. Keep secrets in existing secure configuration. Without credentials, test the adapter with a fake transport and explicitly report external delivery as unverified; the in-app flow must still work.

The following requirements are mandatory across every feature, including mobile. Optimize for a small, understandable implementation with correct behavior. A lower line count alone is not a quality or performance metric.

### System design and module boundaries

- Preserve the existing **modular monolith**. Create cohesive feature modules inside it; do not introduce microservices, a second backend, duplicate mobile apps or a new framework without a demonstrated requirement outside the current architecture.
- Apply separation of concerns, single responsibility and dependency inversion where they help. Use **DRY** for repeated business knowledge, **KISS** for simple designs and **YAGNI** to avoid speculative abstractions. Do not create a class/interface/factory for every small function simply to claim SOLID compliance.
- Controllers handle transport, authenticated context, validation and delegation. Application services coordinate use cases and transactions. Domain functions/policies hold business invariants and state transitions. Repositories/adapters handle Prisma/SQL, storage and external providers. Jobs invoke reusable application behavior rather than copy controller/service logic.
- Keep dependencies directed through explicit module interfaces and Nest dependency injection. Domain decisions should not depend on HTTP, React or storage SDK details. Avoid circular imports, cross-feature access to another feature's internal implementation and unrelated logic accumulated in a giant service.
- On mobile, keep rendering, feature orchestration, API access and shared state distinguishable. Reuse the existing authenticated API client, refresh/error handling and socket connection. Do not create a separate HTTP client, auth store or socket per feature.
- The backend owns eligibility, accepted plan versions, votes, reveal access and rewards. Clients render server decisions and may perform friendly input checks; a duplicated client formula must never become the authoritative permission rule.
- Record entities, state transitions, ownership, transaction boundaries, asynchronous commands and recovery behavior for each new module before implementing it. Extend the existing architecture decision record while coding; do not turn this into a separate documentation-only project.

### Configuration: no scattered hardcoded behavior

- Put secrets and environment-specific infrastructure settings in the existing validated configuration/secret mechanism. This includes database/Redis/storage endpoints, signing keys, API base URLs and push credentials. Keep secrets off mobile bundles and out of source, logs, fixtures and example files.
- Define product defaults once in typed, validated feature/domain configuration: Scene radius/lifetime, venue search radius/limit, media duration/size limits, event schedule/timezone, reveal threshold, streak rewards/cap and query limits. Preserve the defaults in this prompt unless the user changes them. Do not repeat literals such as `15000`, `12`, `5` or `10` across services, jobs and screens to represent the same rule.
- Distinguish infrastructure settings from product policy. Use existing feature-flag/config mechanisms for authorized tunable policy; use named immutable constants for genuine invariants. Do not move every enum, arithmetic zero or spacing value into an environment variable. Normal source constants and configuration defaults are legitimate.
- Validate units, types, ranges and required values at startup/configuration boundaries. Reject invalid policy rather than silently using `NaN`, negative radii, missing keys or unsafe production fallbacks. Document a configuration table with name, purpose, unit, default, allowed range and owner.
- Expose only safe public capabilities/limits to mobile so labels, countdowns and input hints stay consistent with server rules. Send authoritative deadlines, rather than starting an independent client-only timer with a duplicated duration. Offline hints must not grant authorization.
- Snapshot/version policy that affects accepted meetup proposals, event occurrences, report periods or relationship reveal agreements. A live configuration change must not silently rewrite an already agreed plan or reveal rule.
- Keep SQL functions/triggers consistent with that authoritative policy too: use a controlled database policy record/version or a deliberately immutable database rule, rather than an independently tunable TypeScript value that silently disagrees with SQL. Do not build a generic configuration platform when a small typed policy is sufficient.
- Keep visual values in existing semantic theme tokens and user-facing copy in localization resources. Avoid repeated feature-specific hex colors, font names, strings and arbitrary dimensions. Data-dependent styles and ordinary layout constants are acceptable; preserve useful responsiveness.
- Keep demo users, venues, ratings and activity confined to explicit test/seed fixtures. Production code must not display hardcoded successful results when the API fails.

### Reuse, built-in methods and lean code

- Search the repository before adding a component, helper, validator, hook, service, repository or type. Extend the existing implementation when it owns the same responsibility. Do not add `ButtonV2`, another date-planning engine, a parallel error envelope or a copied eligibility query as a shortcut.
- Extract a well-named reusable function when the same rule or cohesive behavior is genuinely shared. Keep feature-specific behavior local. Similar-looking snippets with different privacy or business semantics must not be forced into a misleading universal helper.
- Prefer established platform/framework/database capabilities: Nest injection/guards/pipes, existing validation libraries, Prisma transactions, PostGIS distance/index functions, BullMQ jobs and Node cryptography. Use ordinary JavaScript methods and appropriate data structures when clear; they are not automatically faster merely because they are built in.
- Reuse existing date/time tooling; use `Intl` for supported formatting and timezone-aware tools for calendar calculations. Do not invent cryptography, geospatial indexing, file decoders, authentication, retry queues or timezone arithmetic to avoid a small justified dependency.
- Check installed dependencies before adding packages. Add a maintained, compatible dependency only for an actual gap, recording why the existing stack cannot reasonably cover it. Avoid overlapping libraries for the same job and unnecessary custom wrappers around stable APIs.
- Prefer focused functions, explicit names, early returns and clear return types. Avoid giant components, duplicated derived state, deeply nested branches, compressed one-liners, magic booleans and unsafe type casts used to silence errors. Model mutually exclusive states explicitly.
- Share/generate API contracts from one maintained source and validate untrusted boundaries. Reuse contract-generation tools already in the project instead of creating a new generator framework. Keep persistence entities and secrets out of those contracts.
- Remove obsolete code made unreachable by the change after verifying its callers. Do not retain an unused parallel implementation or refactor unrelated files solely to reduce repetition. Do not impose arbitrary line-count or file-size quotas.

### File structure and coding conventions

Follow the existing repository's established structure, naming, exports, formatting and test placement. There is no single industry-standard folder tree that justifies reorganizing a working project. For a genuinely new backend module, follow the current pattern:

```text
aroha_backend/src/modules/<feature>/
  <feature>.module.ts
  controllers/
  dto/
  application/
  domain/
  infrastructure/
```

Use only the layers needed. Place migrations under the existing Prisma migration directory and queue handlers under the established jobs structure. Put cross-cutting configuration and error handling in the existing `src/config` and `src/common` owners; do not create duplicate global utility folders.

Keep mobile behavior under `frontend-mobile/src/features/<feature>/`, shared primitives under `src/components/ui` or `src/components/layout`, tokens under `src/theme`, and routing in the existing Expo Router tree. Reuse current API-client, type and state locations. Add feature-local components/hooks only when they clarify responsibility; route files should stay thin.

Avoid catch-all files such as a growing `utils.ts`, duplicated DTO declarations and unrelated helpers in a shared directory. Keep tests near their feature or in the existing integration-test directories. Follow the installed TypeScript, lint and formatting configuration rather than introducing competing tooling.

### Measured performance, reliability and observability

- Avoid N+1 queries, unbounded reads, excessive joins and loading entire tables to filter in JavaScript. Select required fields, use suitable indexes and bounded cursor pagination, and inspect realistic query plans for discovery/venues. Keep list counts and queries consistent with authorization.
- Bound external-call concurrency, payloads, batch sizes, timeouts and retries. Queue media processing, report rendering and provider delivery where appropriate rather than blocking interactive requests. Retry transient failures with bounded backoff/jitter, stable idempotency keys and recovery for unknown outcomes.
- Cache only with defined ownership, expiry and invalidation. Include relevant viewer/policy/membership versions in keys and never serve another user's private data from a shared cache. Do not use a stale cache as final permission to reveal media or spend funds.
- Keep mobile lists virtualized, images appropriately sized, media resources cleaned up, requests cancelable and stale responses harmless. Use focused store subscriptions and derive state instead of duplicating it. Apply memoization where profiling or a clear dependency problem justifies it; do not scatter `useMemo`/`useCallback` everywhere.
- Measure relevant before/after query count, latency, payload size, render behavior or memory use on representative data/devices. Record the environment and limitations. Do not claim scalability, a fixed frame rate or percentage improvements without evidence, or remove validation/privacy checks to improve a benchmark.
- Add useful structured errors, correlation IDs and minimal operational metrics for queue delay/failures, rejected transitions and dependency health through existing tooling. Redact personal/sensitive data. Distinguish validation, authorization, conflict and retryable dependency failures in the established error contract.
- Keep migrations backward-compatible where needed, document backfill/index effects and provide feature-disable/recovery steps. Preserve database constraints, transactional invariants and safe retries while optimizing.

### Engineering acceptance check

Before marking a phase complete, review its changed files for duplicated rules/clients/components, scattered configuration, unsafe casts, dead paths, circular dependencies, unnecessary new packages and missing async cleanup. Run the relevant compiler/lint/tests and demonstrate boundary/concurrency behavior. Report reused components/services, new configuration, any justified duplication or abstraction, and measured optimization results. Be accurate about what the repository's scripts actually check; a script named `lint` that only runs TypeScript does not establish a separate lint analysis.

## 4. Feature A — Scenes and casual meetup planning

Create a normalized `Scene` entity with owner, `DATING | FRIENDSHIP | CASUAL_HANG`, activity text, canonical activity tags, optional structured availability window, creation/expiry timestamps, status and version. Maintain one active Scene per owner transactionally.

Default expiry is 12 hours after server creation. A structured availability window must fit inside that lifetime and end eligibility when the activity ends. Validate start/end ordering; do not parse an arbitrary “7 PM” from display text and pretend the schedule is structured. Explicit renewal creates a new availability version. Only the Scene expires; the user's profile, matches and chats remain.

Implement create/read/update/end and `getIntentMatches(userId)`. Preserve existing ordinary discovery as an alternative. Same-Scene candidates require:

1. Both Scenes active and unexpired; same intent.
2. Same canonical activity or meaningful normalized token overlap for uncategorized text. Use reviewed aliases/stopwords; generic words such as “at” and “Hyderabad” are insufficient.
3. Distance within 15,000 metres using PostGIS geography and an appropriate GiST index. Validate longitude-first points, coordinate bounds and a documented location freshness rule.
4. Existing adult eligibility, mutual preferences, account/moderation state, visibility, blocks and relationship exclusions.
5. Overlapping structured windows when both specify them. If one does not, treat time as unconfirmed rather than claiming a shared appointment.

Preflight PostGIS availability, backfill valid profile coordinates and integrate point updates with the actual location-write path. Do not use metre values against angular geometry, concatenate SQL or use volatile `now()` in a partial-index predicate.

Cache by mode, Scene and party version; revalidate expiry/eligibility when reading cached candidate IDs. Use deterministic cursors. Do not silently broaden radius or mix intentions to fill an empty feed. A recommended candidate becomes a match only through mutual interest.

Mobile: compact “Your scene” entry point, activity/intent composer, clear expiry, edit/end/renew actions, useful empty states and readable cards. Public copy shows coarse locality, never raw coordinates or a stranger's live pin.

Extend the existing Date Plan journey as a short **casual meetup** flow launched from chat. Put one primary place search field first, followed by compact category controls and one-row results. A participant picks Tonight, Tomorrow, Weekend or a custom time, then chooses a reviewed café, restaurant or activity, searches the reviewed catalog, opens Google Maps, or enters a public place manually. The location scope defaults to the private halfway point and may switch to Near me or a typed public area. The other participant can accept or suggest another time/place. Reuse existing plan versions and consent rules; a counterproposal clears old acceptance. Do not ask for shared schedules, availability grids, budgets, deposits or office-style planning details. Share the proposed public place before acceptance so both people can make an informed choice, while never revealing either person's origin or the calculated midpoint.

## 5. Feature B — Wingman and a usable group journey

Create party membership, roles, hashed expiring invitations, Scene consent/version, individual votes, canonical pair matches and real group-conversation membership. A person may have only one active/reserved party; enforce this across roles in the database.

State covers pending, active/accepted, declined, expired and disconnected. Use authenticated invite/accept/decline/leave actions and safe deep links. Bind a random single-use token to its invitee and expiry. Prevent self-invites, blocked invitations and simultaneous acceptance into multiple parties. Publish neither the buddy nor the pair until both consent.

With Wingman enabled, derive the active party from authenticated membership and show paired candidates only. Both friends approve the current Scene/version. Require all members to be eligible, no cross-party blocks, and cross-party distances within 15 km. For dating, at least one complete one-to-one pairing must satisfy mutual preferences; do not require everyone to be attracted to both opposing members or disclose private preference reasons.

Both members of A approve B and both members of B approve A. Persist the four votes and create exactly one canonical match transactionally. Votes must not survive a membership or Scene-version change improperly. Give clear waiting/decline/expiry states.

Implement four-person chat with authorized reads/writes, attachments, socket rooms, unread/read state, reports and departure. Use a group model or a constrained conversation-subject abstraction that preserves existing solo chats. Never simulate a group through a fake user or expose a two-person conversation to extra users.

For a complete meeting flow, include a **minimal group plan**: any current participant can propose an activity, public venue and time; all four accept the same version; a counterproposal clears old acceptances; anyone can decline/cancel. Reuse existing Date Plan presentation and privacy concepts while modeling all participants explicitly. This is a deliberate extension beyond the older prompt's group-chat-only boundary. Group calls, private cross-group DMs and four-person money commitments remain outside scope.

On a block, leave or party disconnect, revoke new communication access immediately and freeze/cancel active group plans as appropriate. Specify historical visibility and moderation retention. Test with four distinct accounts, including a departing member and a newly invited buddy who must never inherit old private messages.

## 6. Feature C — Reviewed venue suggestions

Create a maintained public venue catalog with UUID, name, geography point, review status default `PENDING`, review source/date, open/closed status and optional sourced rating, review count, price, accessibility and atmosphere facts. Validate rating/count bounds and retain rating provenance. If a legacy safety boolean is retained, default it to false. Present “Venue details reviewed” rather than promising safety.

Implement a spherical `calculateMidpoint` for two points with validation and explicit identical/antipodal handling. For group plans, use a documented geographic-center strategy across consenting participants; do not pretend the two-person midpoint handles four people automatically. These centers approximate geography, not equal road travel time.

Return a bounded list of reviewed, non-closed public venues within the configured search radius. Support café, restaurant and activity filters plus case-insensitive name/locality search. Default to the private meetup midpoint; allow an actor-only Near me mode and a typed public-area mode. Rank eligible results by sourced rating, review volume and then proximity; null ratings sort after sourced ratings. Show only a coarse sourced price tier when known; mark missing hours/prices as unknown rather than inferring suitability. Return fewer or no venues honestly and preserve a manual public-place proposal path.

The endpoint accepts an authorized match/group/plan ID; obtain coordinates privately. No arbitrary-user location lookups, raw midpoint responses or either participant's coordinates. A rounded distance may be returned only in actor-selected Near me mode; midpoint and typed-area responses do not expose a distance that could help infer a private center.

Add compact venue cards and “Suggest this place” in chat/planning. The selected public place is visible to both authorized participants immediately; personal origins, raw midpoint and exact per-person distances are never returned. Use universal Google Maps URLs for the external handoff so the basic map/search action needs no embedded API key. A future live Places provider requires its own billing, key, attribution and data-governance review; do not represent the reviewed local catalog as live Google Places data.

Use visibly synthetic development venues. Real named venues, ratings, prices and offers require checked sources. **No fabricated 10% coupon, booking, partner badge, newly-opened label or “top-rated” claim.** Paid ads, merchant dashboards, discount redemption, reservation providers and automated opening detection are later scope.

## 7. Feature D — Five-second Vibe media

Build in-app audio/video recording as the primary flow, plus the existing controlled upload pipeline where policy allows imports. Make capture/import policy explicit. Do not claim an in-app recording is uneditable, authentic or proof of identity.

Store owned private media objects, media kind, validated duration, processing/moderation state and safe renditions. Return short-lived authorized `vibe_check_url` values where needed, not arbitrary permanently trusted user URLs.

Use compatible Expo audio/video/camera packages only as required, installed through the supported Expo flow. Provide recording countdown, stop, preview, retake, upload, processing, failure/retry and deletion. State is `UPLOADING -> PROCESSING -> READY`, with rejected/failed/removed branches. Keep the five-second duration limit understandable and the controls accessible. Native dependency/configuration changes require an appropriate development-client rebuild.

The backend checks actual uploaded bytes in a bounded worker with ffprobe/decoder tooling. Verify ownership, MIME signature, codec, size, resolution, streams, decoding and finite positive duration. Reject anything with playable content beyond 5.0 seconds, including an audio track longer than the video. Missing/conflicting timing metadata fails validation. Check generated renditions too. Use safe process arguments, time/resource limits and cleanup; do not fetch arbitrary external URLs.

When enabled, profile-publication policy must require eligible `READY` media on the server. Recommended initial defaults: recording available, mandatory publication gate off, with a controlled pilot flag for requiring it on new profiles. Preserve existing accounts during rollout and provide an accessible alternative. This intentionally revises the pasted list's blanket mandatory requirement.

Profile previews show a calm play/pause control, progress and duration. Never autoplay sound or label an audio clip as photo verification. Under Blind Vibe, protect videos/thumbnails that would reveal the withheld image.

## 8. Feature E — Local language and tone

Implement stable JSON keys, English fallback, interpolation and an optional Hyderabad casual tone independent of language selection. Keep these supplied drafts available for review:

```json
{
  "discovery.empty.casual": "Scene light undi right now, change your spot!",
  "safety.block.casualCandidate": "Baigan mein mila do",
  "datePlan.invite.casual": "Kya bolte, scene kya hai?"
}
```

Use casual text selectively and only for the matching state. Offline, permission-denied and empty-feed messages are different. Keep “Block user”, reporting, consent and permission actions unambiguous; the slang block phrase is candidate secondary copy. Mark mixed-language drafts for Hyderabad-native review rather than calling them verified Telugu translations. Test longer strings, large fonts and screen-reader labels.

## 9. Feature F — Removed: commitment deposits

Do not implement a deposit, mock escrow, payment simulator, QR-funded commitment, payout, refund or compensation flow. Product review found that money and office-style commitment mechanics add friction to casual Gen Z meetups without establishing mutual interest or safety. The existing non-financial Date Plan check-in and safety-contact controls remain available. Vibe Points stay cosmetic, non-cash and non-transferable. Any future money feature requires a new product, legal, provider and trust/safety decision rather than inheriting scope from this superseded section.

## 10. Feature G — Blind Vibe and Thursday Night event

### Relationship photo reveal

Implement `VibeBlurContainer` with `isBlindVibeActive`, server-derived `interactionCount`, `children` and an explicit protected image source or controlled image slot. Native image blur does not blur arbitrary View children; keep buttons and text sharp.

```ts
// Validated public policy supplied for this relationship; defaults are
// revealThreshold = 10 and initialBlurRadius = 20, defined by the policy owner.
const { revealThreshold, initialBlurRadius } = effectiveBlindVibePolicy;
const safeCount = Number.isFinite(interactionCount)
  ? Math.max(0, Math.min(revealThreshold, interactionCount))
  : 0;
const blurRadius = isBlindVibeActive
  ? initialBlurRadius * (1 - safeCount / revealThreshold)
  : 0;
```

This formula controls presentation. Disclosure is enforced by the backend. Before unlock, return only approved obscured previews/renditions, never the original URL through profiles, avatars, notifications, placeholders, prefetch or another endpoint. Use the effective server relationship policy for the component, not a locally editable global toggle. Account for protected image caches and avoid double-applying blur to server-rendered variants unintentionally.

Both participants opt into a new blind introduction. Eligible, persisted, nonempty human text messages count; exclude system messages, duplicate retries, repeated normalized content and rate-limited spam. Default progress is `min(countA, 5) + min(countB, 5)`. Define the per-participant target once in the validated relationship policy and derive the total reveal threshold from it; reject zero/invalid thresholds rather than dividing by zero. Keep progress monotonic/idempotent and do not pretend ten messages prove a meaningful connection. Document eligibility precisely and test it.

Support explicit mutual early reveal. A single user cannot force the other person's photo disclosure. Previously viewed images cannot be hidden retroactively. Use audio-only Vibe previews while blind unless both authorize visual disclosure; the voice alternative remains optional, not a reason to exclude users without a clip under the default media policy.

### Thursday event

Implement actual event occurrences and enrollment, not only a decorative event card. Default schedule: Thursday 20:00–22:00 `Asia/Kolkata`, configurable by authorized operations. Persist UTC occurrence boundaries, audience rules, state, enrollment and a unique occurrence identity. Jobs must be idempotent, and endpoints enforce actual time even if a worker is delayed.

Users explicitly join/leave. Existing discovery and conversations remain available. Determine event eligibility from adult/account/privacy/block/preference rules and the selected dating/friendship intent. Temporary Scenes may improve relevance but must not silently create a second incompatible consent model. Require explicit mutual interest before creating a blind relationship.

UI states: upcoming with date/time, enrollment confirmation, live participation, no eligible participants, left, cancelled and ended. Notify only users who opted in, using real configured delivery. Do not show an invented online count or claim that any participant is guaranteed a match.

At 22:00, stop new event introductions. Existing matches and chats persist; their reveal policy remains in force. Event ending does not automatically reveal images, delete chats or blur/unblur unrelated profiles. Reconcile state on reconnect, background/resume and multiple devices. Use available cohort controls for the pilot rather than force-changing every Hyderabad profile.

Music-service sign-in, playlist imports and licensed playback are not included. Do not insert fake Spotify integration or playlist data to reproduce the attachment's example.

## 11. Feature H — Streaks, Vibe Points and Sunday recap

### Daily activity rewards

Create `UserStreak`, trusted qualifying activities and an immutable points ledger. Initial streaks/balance are zero; initial `lastActivityDate` is NULL, never today's date. Points are cosmetic, non-cash and non-transferable with no redemption or purchase scope.

The qualifying action is a valid, user-initiated Scene publication. Only one award per IST day. App opens, repeated edits, background renewals, swipes, messages, event enrollment and recap sharing do not grant points in this version.

Implement backend-only `increment_user_streak(target_user_id UUID)` and a trigger on trusted activity insertion. Restrict function execution and activity insertion; there is no arbitrary public award endpoint.

Within one caller transaction, capture server time, calculate the IST date, initialize/lock the row, deduplicate the activity and user/day award, then apply:

- First day: streak 1, award 10.
- Same date: unchanged, award 0.
- Yesterday: increment streak, award `min(10 * newStreak, 50)`.
- Older date: reset to 1, award 10.
- Future stored date: no award; surface an integrity anomaly.
- Update longest with `greatest(previousLongest, newStreak)` whenever awarding.

Write the ledger, summary and event atomically, returning typed JSON with current/longest streak, balance, date and awarded amount. Award synchronously with the activity to avoid delayed event ordering changing the day. Show an expired current streak accurately after a gap while keeping the longest record. Do not take away accumulated points for missing a day.

Prefer restricted-role `SECURITY INVOKER`. If a definer function is necessary, use schema-qualified objects and a trusted search path, revoke PUBLIC execution and grant only the intended backend role in the same migration. Ordinary functions participate in their caller's transaction; do not put transaction COMMIT inside them or call external APIs from triggers.

### Sunday Hype Report

Build private weekly aggregation, a mobile recap, a previewable share card and opt-in notification. These are additional functionality beyond the streak counter.

Use a defined initial reporting period: previous Sunday 20:00 IST inclusive to this Sunday 20:00 IST exclusive. Generate after the cutoff and schedule the optional notification after successful generation. Label exact dates/period so it is not mistaken for an unfinished Monday–Sunday calendar week. Persist the reporting version and unique user/period key; duplicate jobs must not duplicate reports, notifications or points. Handle new users, partial history and zero activity honestly.

Allowed initial facts: Scenes published, mutually accepted plans counted once at their first acceptance, the user's qualifying-activity days and points earned in the interval. Use actual persisted events, not device counters or estimates. Do not label an accepted plan as an attended date. Deletions/moderation/consent changes must have a documented effect on report eligibility and future access.

Do not include travelled kilometres, precise movement history, another person's identity, chat excerpts, exact date locations/times, attractiveness ranks or invented achievements. No background location tracking is required. A playful label must describe its supporting fact accurately, such as the user's most-posted Scene category, without claiming physical visits.

Use the current fonts/palette with a clean, expressive card layout. Provide a 9:16 export suitable for a story and a legible in-app version, with safe margins and a subtle Yariva mark. Render/capture the actual card, verify the exported image on-device and provide the platform share sheet or save flow. Do not automatically publish, require Instagram credentials, claim direct Instagram integration without implementing it, or count a share-sheet opening as a published story.

The user previews the export and chooses whether to share. Keep private metrics excluded by default or clearly selectable. Share card URLs/files must not contain private account tokens. Use neutral low-activity copy and let users disable recap notifications and the optional streak display.

## 12. Phased implementation and observable acceptance

Implement in this order, completing each slice and checking regressions before moving on:

| Phase | Deliverable | Proof needed |
| --- | --- | --- |
| 0 | Baseline, live UI inspection, contract/migration decisions, flags and push adapter foundation | Record current failures, actual device/runtime access and existing solo flow behavior |
| 1 | Scenes, core localization and the reusable visual treatment | Two accounts can publish, discover and mutually connect; expiry and privacy work |
| 2 | Casual meetup time and reviewed/manual place selection in solo Date Plans | Quick propose/accept/time-or-place counter/cancel works; both see the proposed place; personal origins remain private |
| 3 | Vibe recording, validated upload and playback | Real valid/invalid files tested; accessible recording and lifecycle behavior inspected |
| 4 | Wingman invite, paired discovery, four-person chat and minimal group plans | Four independent accounts consent and plan; membership changes revoke access |
| 5 | Blind relationship policy and Thursday event | Actual server occurrence states, photo privacy, reveal counting and reconnect tests |
| 6 | Streak ledger, Sunday aggregation and share export | Concurrent rewards deduplicate; accurate report period; verified export and manual share flow |
| 7 | Reserved after deposit removal | No implementation; proceed only after a new explicit product decision |

Complete all scoped phases, subject to any explicit phase/budget limit supplied by the user. Feature flags separate implementation from public rollout. Update the single task tracker described above as subtasks finish, distinguishing built, tested, device-verified and externally blocked work. If provider credentials or a native build are unavailable, finish the independent implementation/tests and state the exact remaining gap; do not substitute a hidden fake success path.

Keep a short architecture decision record covering group conversations/plans, spatial migration, casual meetup privacy, effective photo disclosure, Scene availability, report intervals and rewards. Produce it as part of implementation rather than stopping after documentation.

## 13. Tests and live mobile QA

Use the repository's actual package manager/scripts. Establish baseline backend build/typecheck/Jest and mobile typecheck/lint/Vitest results. Run focused tests for changes and required full checks; report pre-existing failures separately. Use real PostgreSQL with PostGIS for spatial, transaction and function behavior rather than only mocked repositories.

Required meaningful coverage:

- Scenes: 14.9/15/15.1 km boundaries, point ordering, null/stale coordinates, intent/activity/window overlap, exact expiry, cached stale candidates, blocked/hidden users and concurrent replacement.
- Planning/venues: category/text search, unknown data, closed/no venues, quick/custom times, time/place counterproposals, plan-version races, unauthorized coordinates and origin/midpoint leaks.
- Media: zero/malformed/exactly-five/over-five duration, longer secondary tracks, unauthorized object ownership, decoder timeout, moderation, duplicate finalize and publication policy.
- Wingman: simultaneous invites/acceptance, overlap in membership, four votes racing, stale versions, duplicate matches, group message/attachment/socket access, counterproposal acceptance reset, block/leave and all solo regressions.
- Blind/events: 0/5/10 and invalid counts, one-sided messages, repeated content, duplicate events, client-toggle bypass, images leaking through placeholders/caches/video, wrong intent/cohort, start/end boundaries, cancelled events, background/reconnect and multiple devices.
- Streak/report: first day, same day, reset, longest record, daily cap, IST midnight, future-date anomaly, concurrent first insert, rollback, report cutoff, duplicate generation/notifications, low/zero history, privacy and exported-image correctness.

Use the connected physical phone when available. Inspect the running app before changes, start/reuse the correct Metro process, and verify API/worker connectivity. Avoid disrupting unrelated running services. Native modules/config/plugins require rebuilding the development client; Metro refresh alone is not evidence of native integration.

Use test accounts and synthetic/private test media. Exercise two-party interactions and four accounts for Wingman through the actual UI/API, using additional devices/emulators where available. Check permission denial, slow/offline network, process restart, background/resume, keyboard, safe areas, light/dark mode and long content. Simulate event/report time using an isolated test clock rather than changing real production time or waiting a week.

Test representative narrow, normal and wide viewports (including around 320 and 390 logical units), larger text and reduced motion. Inspect screenshots and exported cards for clipped labels, excessive whitespace, low contrast, unreachable actions and mismatched components. Record observed issues, fix them, and capture after evidence. Do not mark UI quality complete because TypeScript compiles or Metro bundles.

If device tooling, credentials or the build cannot be exercised, say precisely which flows remain unverified and why. Do not claim a simulated screenshot is a capture of the connected phone.

## 13A. Proposed later phase: consent-led social expression and safe discovery

This is a **research-gated future proposal**, not an additional implementation phase in this prompt. See `YARIVA_CONSENT_LED_SOCIAL_EXPRESSION_RESEARCH_2026-10-19.md` for the Instagram/competitor comparison, static code audit, privacy risks, roadmap and ready-to-paste research prompt. Do not change application code, migrations, flags or tracker completion states for this proposal without a separate implementation request.

The product hypothesis is a small, private journey from an approved-audience Story to a respectful reply, a reciprocal connection and optionally a real-world plan. Reuse Yariva's existing private Stories, approved follows, Discover, block/report and chat contracts; do not build a duplicate Story system or a general Instagram-like feed. Complete and verify the existing private-Story rollout before extending it. Public, location-based media Broadcast Stories remain outside the active scope below.

Before any later implementation, validate the need with consenting Hyderabad adults across LGBTQ+ and heterosexual groups, including people who are not publicly out. Threat-model inadvertent exposure through suggested profiles, mutual connections, contacts, audience changes, notifications, cached Discover results, media links and moderation states. Never infer orientation or community membership from dating preferences. Default to private relationship information, explicit audience choices and server-enforced access. Contact shielding is best effort and must not be described as a guarantee.

The first implementation slice, if research supports it and the user authorizes it, should fix and verify current privacy gaps before adding recommendation or expression surfaces. Judge outcomes by safe reciprocal conversations, voluntary plans and user-reported comfort, alongside report and unwanted-exposure rates; do not optimize for compulsive opens or time spent.

## 13B. Authorized pilot: Events feed and nearby places

**Implementation authorized; scope updated 29 October 2026.** Replace the visible Meetups bottom tab with **Events**, whose primary screen is a vertically scrolling, photo-led event feed. This supersedes the earlier compact Events subsection proposal. Preserve current DatePlans and meetup actions through a compact **My plans** destination; preserve existing route compatibility where practical. Track EVM-01 through EVM-08 in `YARIVA_IMPLEMENTATION_PROGRESS.md`. Authorization covers local implementation and validation, not paid-provider setup, production deployment or claims of completion.

The useful product journey is **find a real event or public place → save privately → invite an active match → discuss in the existing chat → mutually agree on a DatePlan**. Build on the current Meetups, DatePlan, match, chat, venue, block/report and shared-theme systems. An approved follower alone does not gain the right to invite someone to a meetup. Use a calm, paginated event feed with one main card per row, clear event details and private saves; do not duplicate meetup/chat systems or introduce manipulative engagement mechanics. When the initial discovery result contains no eligible events, show real reviewed cafés and restaurants as **Places to meet**, with venue details and existing planning actions. Never disguise places as events, treat loading/failure as empty supply, or replace an intentionally empty Saved list with venues. Validate whether a focused Hyderabad pilot gives users a reason to meet before expanding supply or organizer tools.

- [ ] **EVM-01 — Baseline and pilot contract.** Inspect current Meetups, DatePlans, reviewed venues, match policy, admin/moderation and flags; document reusable paths, real gaps, the selected Hyderabad neighborhoods/categories and a small release gate. Do not assume a screen proves its backend behavior. Keep location and catalog design city-agnostic even if the first content is Hyderabad-only.
- [ ] **EVM-02 — Trustworthy event catalog.** Model event listings separately from DatePlans and existing Blind/Thursday occurrences. Provide authorized admin curation and source/organizer provenance, images where licensed, schedule with timezone, locality/address, category, known price or explicit unknown price, official external booking link and publication/cancellation/expiry status. Validate URLs and ownership, deduplicate, index and paginate; never show cancelled or expired items as available or invent ticket inventory, discounts or availability.
- [ ] **EVM-03 — Events tab, feed and private saves.** Make Events the main bottom-tab destination, with a vertically scrolling photo-led feed and compact access to My plans. Provide date, category, location and price filtering only where source data supports it. Use consented location or manual selection; rank relevant nearby listings and handle sparse supply, loading, offline, missing permission and no-results states. Saves stay private and respect blocks, account state and authorization.
- [ ] **EVM-04 — Organizer submission, staged.** Begin with authorized admin-added listings. If verified local organizer supply warrants it, add only the smallest organizer profile/submission/edit/cancellation-request/status flow. Require ownership verification, approval before publication, spam and duplicate controls, review of material changes and reporting/moderation. Defer a full self-service dashboard, ticketing and payments.
- [ ] **EVM-05 — Empty-feed café/restaurant fallback.** When the first successful event query has no eligible results, show clearly labeled real reviewed cafés/restaurants using the existing venue catalog. Preserve manual location and respect applied constraints; explain if no matching places exist. Do not show fallback during loading, API failures or an empty Saved list. Do not call venues nearby without coordinates/distance support. Reuse the reviewed venue catalog first. Consider an authorized live Places provider only after keys, billing, terms, attribution, caching, field selection and operating cost are resolved. Label data freshness and unknown opening/price details honestly; do not present fixtures as real venues. Include cafés, restaurants, parks and other suitable public places without revealing a person's precise live or home location.
- [ ] **EVM-06 — Consensual invite to plan.** Let a user invite an eligible active match to a selected listing through existing chat and DatePlan flows. Enforce blocks, privacy and current match status server-side. Store an event reference or agreed snapshot; show cancellation/material changes and obtain fresh agreement instead of silently changing an accepted plan. Keep event interest/attendance private unless each person explicitly opts in.
- [ ] **EVM-07 — Safety and inclusive UX.** Limit the pilot to adults; do not market or distribute near colleges in a way that targets minors. Preserve LGBTQ+ privacy, manual-location choice, reporting and blocking. Apply the existing Warm Human Modern tokens, accessible touch targets, safe areas and clear source/status labels across Android states; do not add a second visual system.
- [ ] **EVM-08 — Evidence and rollout.** Test organizer/admin authorization, approval/edit/cancel/expiry, duplicate and invalid listings, location/ranking/pagination, URL safety, private saves, match/block/invite boundaries and DatePlan change consent. Verify Android end to end, including empty/offline/permission states and light/dark/large text; report PASS/FAIL/BLOCKED accurately. Pilot with a small number of legitimate listings and monitor valid supply by locality, stale/cancelled rate, invite-to-accepted-plan conversion, privacy/safety reports and user feedback before widening access. Do not claim launch readiness from seeded mock data or a successful build alone.

## 14. Scope and completion contract

Included: the authorized Events pilot in section 13B, the seven active feature areas above, Thursday occurrences, private Sunday recap/export, casual solo meetup planning, minimal group plans, real push adapter implementation and the existing UI foundation refined where observed issues require it. The removed Feature F is documented but not counted as active scope.

Explicit boundaries: deposits, payment simulators, payouts/refunds, commercial coupons/ads/bookings, music-provider integration, public live-location maps, media Broadcast Stories, micro-squads, forced trivia games, automatic social posting, a new logo/name and a complete brand redesign are not part of this scope. Do not add them incidentally.

Return a concise handoff containing:

1. What works end to end and which flags expose it.
2. Changed files, migrations, generated contracts and important decisions.
3. Environment/native setup and any remaining external dependency.
4. Actual test commands/results, including failures and their ownership.
5. Device/screenshots/share-export evidence and any unverified paths.
6. Remaining product or rollout limitations, especially reviewed venue coverage, live Places integration and notification delivery status.
7. Architecture/reuse review, configuration table, dependency rationale and any measured performance changes, including the measurement environment and limits.
8. Link to the updated tracker, task IDs completed in this run, remaining work and blockers; do not paste the entire checklist into the handoff.

UI/UX acceptance means clear, consistent, responsive and usable behavior across real states. Do not claim it automatically satisfies all Gen Z users or guarantees growth. Add minimal outcome instrumentation for reciprocal connections, agreed plans and voluntarily reported experience so the team can evaluate the actual product.

Begin by inspecting the repository and running app, establish the baseline, then implement the phases above. Do not end with another proposal to begin.
