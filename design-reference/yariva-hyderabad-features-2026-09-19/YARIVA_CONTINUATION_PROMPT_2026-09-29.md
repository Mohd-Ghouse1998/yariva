# Yariva continuation prompt — paste into Update Yariva mobile UI

Continue the approved Yariva implementation **in this existing task**, using its existing goal, history, latest user decisions and remaining budget. This message authorizes continuing the remaining approved implementation. Preserve completed work and continue from the actual current checkpoint. Do not restart the project, duplicate implementation or reset/recreate the goal.

Workspace: `/Users/mohdghouse/Documents/Aroha`.

Read these files directly from the workspace; start with the checkpoint and handoff, then the relevant master-prompt sections:

1. `design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_IMPLEMENTATION_PROGRESS.md` — the single progress tracker.
2. `design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_PARTIAL_IMPLEMENTATION_HANDOFF_2026-09-29.md` — partial shared-workspace edits and known unfinished issues.
3. `design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_FULL_STACK_UI_UX_MASTER_PROMPT_2026-09-20.md` — canonical feature, engineering and UI/UX requirements.
4. `design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_ARCHITECTURE_DECISIONS.md` — existing decisions to preserve and extend where needed.

My latest product decisions in this task take priority over older documents. The handoff records facts, not a replacement specification. Continue using the current codebase: NestJS/Prisma/PostgreSQL backend and Expo/React Native mobile app.

## First reconcile the current state

Your latest recorded checkpoint completed **P4-02**, including user-facing **Duo** naming, invitations/Scene consent, paired discovery, private votes and exactly-once four-person matching. Scenes, solo meetup planning, reviewed venues, Vibe media and localization already have prior completion evidence. Do not rebuild them.

Another planning task started partial P4-03/group-plan and guided voice-introduction backend edits, then stopped when I asked to keep implementation here. These edits remain in the shared workspace. The migration `20260929000000_duo_conversations_and_voice_hello` is **unapplied**, the Prisma client was regenerated, backend TypeScript checking passed, and no integration/mobile/device sign-off exists for those changes. Inspect and finish or correct them; do not duplicate them or treat them as completed. Resolve backend/mobile contract differences and the authorization/race issues recorded in the handoff before relying on the draft.

## Complete the remaining approved work

Work in verified vertical slices, beginning with **P4-03**:

1. **Finish Duo: P4-03–P4-07.** Real four-person chat, messages/attachments/realtime/read state/reporting, immediate block/leave revocation, and lightweight group meetup plans. All four accept the same version; counters invalidate earlier acceptances. A new buddy never inherits old private messages. Reuse shared chat/plan UI and private reviewed-venue search with a documented four-person center strategy. Verify four-account journeys and solo regressions. Retain stable internal `wingman` identifiers and user-facing **Duo**.
2. **Add the approved optional guided voice introduction: HELLO-01–HELLO-04.** After a solo mutual match, offer a compact “Say hello” action through the existing audio-call system. The other person can accept or decline; respect both users' call preferences and block/unmatch state. Provide a simple shared-Scene conversation prompt with a generic fallback, accessible call controls, and an easy return to chat or Meet after the call. Keep ordinary calls working. This is an optional human-to-human introduction; no random strangers, forced calls/countdowns, AI companion, new AI provider, group calls or private cross-Duo DMs.
3. **Finish Phase 5:** optional mutually consented Blind Vibe with server-controlled reveal progress and protected media, plus Thursday event enrollment/occurrences/IST transitions and post-event conversation continuity. Client blur alone must never expose private originals. Follow the canonical eligibility and consent rules.
4. **Finish Phase 6:** trustworthy daily streaks/Vibe Points with atomic deduplicated rewards and IST day boundaries, private Sunday recap, and a previewable themed 9:16 export for manual sharing. No automatic social posting or fabricated metrics.
5. **Complete final QA and handoff.** Resolve introduced regressions and finish all independently available checks. Keep genuinely external checks explicitly blocked, with the exact remaining dependency.

Deposits, escrow, payments, advertisements, bookings, commercial music, public live-location maps, forced trivia, a new brand/logo and other previously excluded features remain outside this scope.

## UI/UX and engineering acceptance

Use the existing **mobile_app_v3 foundation**, current Yariva/Profile-tab shared theme, Space Grotesk headings, Inter body/controls, semantic palette, compact buttons/inputs/dialogs, spacing and responsive behavior. Reuse existing components and tokens. Keep the current UX unless an observed issue justifies a focused fix; every new journey must feel native to the existing app. Handle loading, empty, offline, permission, expiry and error states clearly.

Preserve the existing modular architecture, strict typed API contracts and error handling. Reuse helpers and built-in APIs; avoid duplicate clients/modules, scattered business constants, hardcoded secrets, unnecessary packages or speculative abstractions. Use additive reviewed migrations, explicit participant authorization, durable/idempotent events and meaningful concurrency tests. Preserve unrelated work and data.

Run/reuse the correct backend, worker and Metro, and check changes live on the physical phone. Respect my existing device-inspection/screenshot preferences in this task. Verify actual rendered layouts as far as the permitted tools allow; state any visual limitations accurately. Check wireless ADB before assuming the phone remains connected. Do not disrupt unrelated services: the handoff records port 3000 as occupied by another process. Rebuild the native development client only when native changes require it.

## Tracking and token efficiency

Maintain **only** `YARIVA_IMPLEMENTATION_PROGRESS.md` for progress. Update the checkpoint, task boxes and concise evidence after each meaningful completion. `[x]` means acceptance criteria verified; `[ ]` means pending, partial or blocked. Preserve prior evidence, reopening only affected work when changed contracts invalidate it. Compilation is not device verification, and mocks are not live provider delivery.

Read selectively with bounded output; do not rescan the whole repository or repeatedly run unchanged checks. Reuse valid context, sessions and helpers. Run focused tests while implementing and the required broader gates when shared behavior changes. Do not create extra agents/tasks or repeat large plans/code in chat. Respect the existing goal/budget limits and save a precise checkpoint if a limit is reached.

Begin reconciling P4-03 now and continue the remaining authorized slices. Finish with a concise summary of verified work, remaining/blocked task IDs, actual test/device results and the tracker link. Do not mark the existing goal complete until its actual scope is satisfied.
