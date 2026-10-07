# Paste into “Update Yariva mobile UI”

Continue implementation in the existing Yariva codebase and existing goal. First prioritize the focused UI/UX corrections below, then resume the remaining authorized feature work. Build and fix the actual app; do not create a Figma project or start another redesign codebase.

## Read these first

1. /Users/mohdghouse/Documents/Aroha/design-reference/yariva-ui-audit-2026-09-29/YARIVA_LIVE_UI_UX_REVIEW.md — current live/source evidence, issue IDs and coverage limits.
2. /Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_IMPLEMENTATION_PROGRESS.md — latest completion status and runtime checkpoint; read its current contents rather than relying on old messages.
3. /Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_FULL_STACK_UI_UX_MASTER_PROMPT_2026-09-20.md — canonical feature and engineering requirements.
4. /Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_ARCHITECTURE_DECISIONS.md — resolved scope and backend rules.

The older continuation/partial handoff contains superseded implementation status. Do not redo completed Duo, guided hello, Blind Vibe or Profile navigation work merely because an old document says it is pending. Reconfirm each audit finding against the latest code/runtime; if already fixed, record current evidence instead of duplicating it.

## Design direction

Preserve the existing mobile_app_v3 foundation: Space Grotesk display/headings, Inter body/control/input text, compact button/input geometry, responsive gutters, shared navigation and shared light/dark theme. Inspect /Users/mohdghouse/Desktop/new/Backend/mobile_app_v3 only for relevant component/token references; do not copy its whole application.

Current Yariva semantic tokens are authoritative: warm neutral/ivory surfaces, charcoal actions/text, restrained champagne accents, dedicated success/trust/error colors. Do not change the palette to pink, cherry, neon or blue or start another brand-name/logo exercise. Make the app feel premium through readable hierarchy, good spacing, clear states, quality existing media and predictable controls.

Preserve working UX and supported functions. Change navigation or interaction only where evidence shows confusion, unwanted side effects, excessive friction or breakage. Keep one clear primary action, reveal secondary controls progressively and avoid decorative clutter. Compact means efficient space use, not tiny text or unsafe tap targets. Do not duplicate Profile destinations or add content just to fill whitespace.

Users should return for wanted replies, useful invitations and real plans. Do not add forced streak interruptions, fake activity, fabricated urgency or endless scrolling to create “addiction.” Do not claim Gen Z appeal without testing with intended users.

## Implement the audit corrections

Add the following task IDs to the existing progress tracker, initially unchecked. Work in small related slices and update evidence after verification.

- [ ] UX-01 — Trace “Hide from contacts” from UI to actual contact ingestion/exclusion and all affected discovery paths. The audit found only a stored boolean. If enforcement is absent, remove the misleading actionable toggle or present the capability clearly as unavailable while preserving data. Do not claim contact protection based on saving a setting. Do not build an entirely new contact-ingestion service as an unreviewed side effect of a UI polish task.
- [ ] UX-02 — Reconcile persistent profile intents, desired-partner filters and daily Scene intents against supported backend/product contracts. Looking for currently offers three options, Discover filters four different options, and Discovery Preferences all seven enum values. Share typed option definitions and human labels where semantics coincide; preserve valid existing selections when editing. Verify an existing friendship intent cannot be silently erased by opening/saving a restricted editor. If some choices are intentionally unsupported, state that clearly without inventing new backend capabilities.
- [ ] UX-03 — Improve Discover's initial hierarchy. Scenes, Duo and Blind Vibe currently push the first person's primary decisions below the initial viewport on the connected 360dp-wide phone. Keep the features discoverable, compact their entry treatment and prioritize the person/decision. Preserve readable labels, feature states and accessible targets; do not shrink everything to fit. Demonstrate the improved initial viewport and scrolling behavior live.
- [ ] UX-04 — Make Meetup display groups date-aware. A confirmed September 24 plan appears in Upcoming on September 29 because grouping uses status alone. Use the scheduled time/duration and a documented elapsed-plan display rule. Do not falsify attendance, completion or cancellations. Handle timezone/day boundaries and refresh after resume/time changes. Check the equivalent Duo plan presentation for the same class of stale-time issue.
- [ ] UX-05 — Make expired Scene renewal deliberate. The visible “My Scene” tile currently calls renewal immediately when expired. Show Expired and an explicit Renew Scene action with review/confirmation of the activity and availability before publication. Reuse existing composer/confirmation components and preserve server expiration, idempotency and trusted activity/reward rules.
- [ ] UX-06 — Align Chat and Report input typography with shared Inter tokens. Their native TextInput styles omit fontFamily. Reuse existing typography or field components appropriately; preserve chat multiline growth, keyboard clearance, selection, errors and focus. SceneViewer already uses typography.body, so do not rewrite it unnecessarily.
- [ ] UX-07 — Meet the existing 48dp effective touch-target contract in tabs, segmented controls, interactive chips and schedule-day selectors. Current source has 44/34/44/40dp targets without equivalent expanded hit regions. Preserve compact visible controls, ensure targets do not overlap, and reflow seven-day choices where needed. Keep content/footers clear of the floating tab bar, keyboard and system bars.
- [ ] UX-08 — Make labels explicit and consistent. Full Profile's “WEEKLY / OMNIVORE / BALANCED” values need their meanings, such as “Exercise · Weekly.” Replace mechanically formatted optional headings with approved copy. Reconcile Duo/Wingman and Connect/Connections/Meet/Meetups across current screens, notifications and accessibility labels. Short tab labels can remain short when clear. Preserve internal identifiers and compatibility routes.
- [ ] UX-09 — Apply conservative final polish: shorten My Vibe's overlong row description, maintain readable secondary text and appropriate wrapping, and standardize relevant spacing/radii/pressed/loading states through shared primitives. Preserve the completed PROFILE-UX-01/02 single-owner navigation fix. Do not introduce repeated menus.

## Verify the whole app honestly

Use the connected physical phone and existing Metro session to inspect live pages and confirm changes. The audit's last observed setup was USB-online SM-G990E, app com.aroha.mobile, Metro 8081/backend 3001; wireless was offline. Re-read current device/runtime state before issuing commands. Keep existing services running unless a necessary change requires a restart. JavaScript/style fixes should use Metro; rebuild the native dev client only for native dependency/config changes.

Do not capture screenshots, images, screen recordings or UI videos. Use live navigation, accessibility hierarchy/control bounds, safe test data, focused logs and source comparison. Never claim this proves pixel-level appearance, photo cropping, measured contrast or smoothness; mark those checks unverified when this method cannot establish them. Do not print full hierarchy dumps, secrets or session tokens into chat.

Maintain a compact coverage matrix for:

- Discover, filters, profile decisions and Full Profile.
- Connections empty/list/detail states and match celebration.
- Solo, Duo and Blind chats, menu/attachment/hello consent overlays, keyboard opening/closing and retained drafts.
- Meetups list/composer/detail, venue category/location controls, pending/counter/confirmed/past states and safety tools.
- Scenes create/view/edit/expired/renew states, Duo invite/connected/discovery/group plans, Blind event/join/locked/revealed states, Vibe permission/studio/processing/playback states.
- Profile dashboard, Edit Profile hub and every nested editor/dialog.
- Every Settings page, Activity, Report/Block and error/retry states.
- Welcome/Login/Signup/OTP and onboarding intro/steps/review using safe test-account handling; incoming/active/missed calls only with controlled authorized test participants.
- Remaining recap/streak screens after their separate authorized implementation. Do not mark nonexistent screens verified.

Mark each state as live verified, source reviewed, pending or blocked, with concise evidence. Never call source-only review a live pass. Do not message, call, invite, report, block, revoke, publish or otherwise affect real users to collect audit evidence. Use isolated fixtures/test participants for state-changing regressions; do not overwrite the signed-in profile to force a scenario.

Check representative screens in Light/Dark, normal and 1.3× text, short/narrow layouts, long strings, scrolling, keyboard and hardware Back. Restore the original phone text/theme settings afterward. Use existing responsive test infrastructure for other widths; do not claim iOS/tablet physical-device sign-off from one Android phone. Confirm critical controls remain reachable and text readable. Preserve any unsaved form input and existing conversation privacy/reveal rules.

## Engineering and efficiency

- Extend the existing shared Button, Input, Text, Card, Header, navigation, dialogs, Screen/ScreenFooter and theme utilities. Use existing feature folders, thin Expo Router routes, typed API modules, localization and error patterns. No parallel UI kit, duplicated controllers, copied feature code or replacement state store.
- Keep tokens and shared business/option definitions centralized. No hardcoded user IDs, venues, fake ratings, test names, secrets, device-specific coordinate layouts or repeated hex/font values in product code. Legitimate defaults/layout constants remain allowed when they are centralized and justified.
- Use focused reusable functions and platform/library APIs where appropriate. Do not add packages or generic abstractions without a concrete need. Preserve existing contracts and unrelated changes.
- Check relevant repository instructions and status in the actual mobile/backend repository roots before editing; the containing Aroha directory is not itself a Git repository. Reconcile shared-workspace work in progress.
- Search targeted paths with rg. Exclude node_modules, generated clients, build/dist, coverage, archived bundles and temporary APK copies. Read the current checkpoint once, inspect focused sections, batch independent reads and avoid repeated full-repo scans or verbose tool output.
- Run required typecheck/lint and meaningful regression checks for changed behavior. Prioritize intent preservation, time grouping, explicit Scene renewal, safe hit areas and unaffected privacy/navigation contracts. Reuse existing test suites; do not add tests that merely duplicate styling declarations. Expand testing when changes/failures justify it.
- Backend changes should be limited to a demonstrated contract/enforcement problem needed for these fixes. Do not run destructive migrations, reset databases or deploy unrelated pending migrations just to restyle a page.

## Progress and completion

Keep YARIVA_IMPLEMENTATION_PROGRESS.md as the only implementation progress authority. Update its checkpoint, UX task boxes, coverage and concise validation evidence after each completed slice. Tick only when the task's acceptance criteria are met; leave partial/source-only/external checks unchecked with their exact remaining step. Retain prior feature evidence and reopen only genuinely affected work.

Start with UX-01/02 contract verification, then fix UX-04/05 behavior, then the shared controls/Discover/input treatment, then copy and broader live regression. Continue autonomously within this scope; ask only for a genuinely unresolved product constraint after completing independent work. Finish with changed behavior, actual tests/device coverage, remaining limitations and the tracker link. Do not mark the overall existing goal complete while P6 or required final QA remains unfinished.
