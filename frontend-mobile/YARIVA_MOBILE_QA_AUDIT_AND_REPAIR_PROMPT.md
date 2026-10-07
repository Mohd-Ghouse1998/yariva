# Yariva Mobile — Connected-Device QA Audit and Repair Prompt

Audit date: 30 August 2026  
Project: `/Users/mohdghouse/Documents/Aroha/frontend-mobile`  
Installed Android package: `com.aroha.mobile`  
Test device: Samsung SM-G990E, 1080×2340 px, density 480 (360×780 dp)

## Executive verdict

Yariva is **not production-ready**. The product direction and warm ivory / plum / petal visual language can become premium, but the installed build currently has release-blocking navigation, layout, data-safety, call, branding, and packaging defects.

The most visible problem is not the palette. It is the implementation foundation: the shared tab header is structurally broken, many pages bypass shared shells, component heights are oversized, bottom insets are hard-coded, and forms/sheets are not consistently keyboard-safe. Changing the theme again would only hide these problems temporarily.

Do not publish the current APK. Its release variant is signed with the Android debug certificate, its native icon/splash assets are invalid for Android adaptive masks, and the file/version metadata does not match the claimed build.

## How this audit was performed

- Interacted with the installed app on the connected physical phone as an end user.
- Used Android accessibility/UI hierarchy and input-state data to measure bounds, focus, keyboard behavior, labels, and navigation outcomes.
- Did **not** take screenshots during this audit.
- Exercised all five primary tabs and 23 representative routes/screens, including Discover filters, public profiles, Connections, Activity, plan detail/composer, Chats, Conversation/options, Match detail, Profile, Settings and its nested pages, Edit Profile, three profile-edit onboarding screens, and Report.
- Reviewed all 37 Expo routes in source, every shared layout/navigation primitive, brand/native resources, APK metadata, and release signing configuration.
- Avoided destructive actions: no messages were sent, no preferences were saved, no profile was liked/passed, no report was submitted, nobody was blocked/unmatched, no session was revoked, no plan was changed/cancelled, and the user was not logged out.
- Voice/video calls were source-audited but not fully exercised because a real two-device call participant was unavailable. Signed-out authentication screens were source-audited rather than clearing the user's authenticated phone state.

Current automated checks pass TypeScript, ESLint, and 27 Vitest tests. Those tests cover utilities and a few components; they do not cover route integration, layouts, keyboard behavior, error states, theme switching, accessibility, calls, or the critical editing flows found here.

## Connected-phone findings

### 1. Shared tab headers overlap and intercept taps — release blocker

Observed on Discover, Connections, Chats, and Profile:

- Discover title bounds: `[415,138][665,216]` px.
- Hyderabad/location bounds: `[408,153][672,204]` px.
- These elements visibly occupy the same space.
- The filter control is placed at `[474,243][606,375]`; the Discover card begins at y=279. Their hit regions overlap by 96 px.
- Tapping the visible center of the filter opened Asha's profile. Only its narrow upper strip, above the card, opened Filters.
- Connections/Chats notification controls occupy the same `[474,243][606,375]` region, overlapping the subtitle and segmented/list content.
- Profile has the same problem: tapping the visible center of Settings was intercepted by the profile hero. Only the upper strip opened Settings.

Root cause: `src/components/layout/TabHeader.tsx` gives the row a fixed height but omits `flexDirection: "row"`; its children stack vertically while the centered title is absolutely overlaid.

### 2. Filter modal is not a safe centered modal

- Modal bounds: `[48,326][1032,1970]`.
- Title and subtitle occupy y=359–500.
- Close button occupies `[480,370][600,490]`, directly covering both title and subtitle.
- Chips and controls are visually oversized.
- It lacks a reliable shared scroll/keyboard/accessibility-modal contract.

### 3. Bottom navigation covers real content

- Floating dock bounds: approximately y=1993–2177.
- Connections' last Nadia card extended to y=2199 behind the dock.
- Profile quick actions and other list endings similarly extend underneath it.
- Every tab reserves its own magic bottom padding while toasts use a separate fixed bottom value. The contract breaks under content growth, keyboard, and alternate Android navigation modes.

### 4. Forms are inconsistently keyboard-safe

- Conversation composer correctly moved above the keyboard and remained usable.
- Date Plan composer did not: locality input and primary CTA remained at y=1629–2076 while the Android keyboard was open, leaving them covered.
- Edit Profile focusing Headline scrolled the field under the fixed header; the hierarchy reported inverted visible bounds `[111,291][969,212]`.
- Report details moved above the keyboard correctly, showing that the defect is shell-specific rather than device-specific.

### 5. Profile editing is routed through onboarding

- Tapping Interests opened `STEP 4 OF 9` rather than a focused edit screen.
- Tapping Schedule opened `STEP 6 OF 9`.
- Tapping Manage photos opened `STEP 9 OF 9`.
- These screens retain onboarding Continue/Finish semantics and can push users through unrelated setup sections.
- Interests says “Pick at least 5,” but the installed account had 4 selected and Continue was enabled.
- Schedule's day controls fit this 360 dp device exactly, but `M/T/W/T/F/S/S` gives duplicated, ambiguous accessibility names. The same fixed row overflows at 320 dp.

### 6. Edit Profile can mislead or overwrite

- Save is enabled immediately before any change.
- There is no blocking initial-load/error state or dirty-form guard.
- The photo editor exposes add slots but no delete, reorder, or make-primary controls.
- A load failure can leave editable defaults that are later saved over real profile data.

### 7. Sessions shows incorrect security identity

On the connected Samsung Android phone, Devices & Sessions reported:

- `iPhone 15`
- `IOS · v0.1.0`
- `THIS DEVICE`

It also showed a Pixel 8 as another device. Device/session identity cannot be trusted in its current state, and revoke actions lack confirmations and per-action busy protection.

### 8. Privacy controls permit contradictory state

- “Discoverable” was on while “Pause discovery” was independently off.
- Both are separate optimistic toggles; failed requests do not roll the UI back.
- Full-width switch rows are 72–108 dp tall, contributing heavily to the bulky appearance.

### 9. Activity/notification experience is incomplete

- Activity uses a large left-aligned header with no visible Back action, unlike other nested screens.
- It has no pagination trigger even though a cursor is stored.
- Notification initials such as `YO`, `AS`, and `MI` are derived from phrases rather than stable actor identity/avatar.
- Rows are oversized and reading a notification is awaited before navigation.

### 10. Date Plans expose implementation details and artificial limits

- Customer-facing copy says `Fallback AI · no paid key required`.
- Scheduling is restricted to fixed 2/3/7-day choices and 5:30 PM.
- Keyboard covers the locality field and CTA on Android.
- “Flexible” cost can display as `₹0–₹0` in detail.
- Suggesting a different time blindly adds 24 hours.
- The plan list can fail entirely if optional match-name enrichment fails.

### 11. Chat and match flows work at a basic level but are incomplete

- Back, composer keyboard avoidance, menu opening, plan navigation, and representative chat navigation worked.
- Presence is hard-coded as `Active recently` with a live-looking green indicator.
- Only the newest 50 messages load; there is no older-history pagination.
- Realtime updates can increment unread for own messages and do not reorder the conversation row.
- The app forces scroll to bottom on message-count/typing changes.
- Non-image attachments cannot be opened.
- Match action tiles are about 73 dp tall and feel bulky.
- Unmatch has no confirmation.

### 12. Safety/report UI needs stronger semantics

- Report screen opens and is keyboard-safe.
- `Other` still treats details as optional.
- Invalid route parameters are not validated into a proper unavailable/error state.
- Block modal remains dismissible while its action is busy and lacks modal focus containment.
- Emergency actions exist in plan detail; they were intentionally not triggered during this audit.

## Source/APK release blockers

### P0 — must be fixed before any external beta

1. **Debug-signed release:** `android/app/build.gradle` assigns `signingConfigs.debug` to `release`.
2. **Broken shared tab header:** `src/components/layout/TabHeader.tsx` lacks a horizontal row layout and safe three-zone sizing.
3. **Invalid Android icon pipeline:** `app.json` reuses one opaque, off-center screenshot-style `logo-square.png` as the legacy icon, adaptive foreground, and splash image.
4. **Native asset/version mismatch:** a JS-bundle patch cannot update launcher/splash assets; the APK called v0.2.6 still reports versionCode 1/versionName 0.1.0.
5. **Public-profile lookup is unreliable:** `ProfileDetailScreen` searches only the current eight-person Discover feed. Valid likers/notifications/deep links can falsely show unavailable.
6. **Profile section editing can overwrite data:** onboarding screens silently use defaults after load failures and PUT whole sections.
7. **Persisted authentication is mishandled offline:** a timeout/network failure can make a valid stored session appear logged out.
8. **Video call is nonfunctional:** streams are acquired but neither remote video nor local preview is rendered; timer/security copy are also unreliable.

### P1 — must be fixed before production release

1. Replace mutable global theme objects/root-tree remount with immutable context themes and theme-aware styles.
2. Fix light primary contrast: `#C86E91` with white is approximately 3.45:1. Use `#AD5679` with white or deep plum text where appropriate.
3. Create one measured bottom-inset contract for tabs, lists, toasts, sheets, and keyboard—not page-specific `124`/`88` values.
4. Create shared route shells for tab pages, nested pages, scrollable forms, conversation/keyboard pages, media pages, and modal sheets.
5. Replace exact heights with `minHeight`, content-aware padding, compact visual pills, and independent 44×44 dp hit targets.
6. Map Inter typography tokens to the actually loaded `Inter`, `Inter-Medium`, `Inter-SemiBold`, and `Inter-Bold` families.
7. Add loading/content/true-empty/offline/error/unauthorized/not-found/retry states to every data screen.
8. Make privacy/communication mutations serialized, rollback-safe, and reconciled with server responses.
9. Complete chat history, presence, receipt, attachment, unread, realtime order, and scroll behavior.
10. Give Activity a shared centered header/back, pagination, immediate navigation, and explicit notification-type handling.
11. Unify onboarding and Discover preference validation/ranges; make interest search latest-wins/cancellable.
12. Replace artificial Date Plan scheduling with real date/time input and decoupled enrichment.
13. Add confirmation/busy/error handling for unmatch, block, unblock, revoke, cancel, and similar sensitive mutations.
14. Make every bottom sheet scrollable, keyboard-safe, rotation-aware, and modal-accessible.
15. Complete the technical rebrand or deliberately preserve backward-compatible identifiers with a migration plan.

## Brand/icon correction

The launcher problem is an asset problem, not a phone-cache problem.

- Current foreground has no alpha and is optically off-center.
- The descending `y` exceeds Android's safe mask region and is clipped by Samsung's squircle.
- The same light asset creates a white box on the dark native splash.
- `ArohaMark.tsx` crops a full wordmark using magic ratios instead of rendering a real mark.
- Native splash colors still include old white/blue values and jump to a different React splash composition.
- There is no Android monochrome/themed icon.
- `DESIGN.md` still documents Aroha-era tokens.

Required assets:

- A real vector master for the standalone Yariva mark and wordmark.
- 1024×1024 opaque iOS/legacy icon.
- 1024×1024 transparent Android adaptive foreground with critical geometry safely centered.
- Android monochrome foreground.
- Separate transparent light/dark splash marks.
- Clean SVG/native-vector wordmarks; no screenshot cropping or raster noise.

Recommended app-icon treatment: deep plum background, ivory mark, and at most one restrained petal connection accent. Keep the in-app canvas warm ivory. Do not redesign the whole theme to solve an icon-export defect.

## Product design direction

Keep the current dating-first Yariva position and the edge-to-edge, photo-led Discover concept. The right target is:

- warm ivory canvas `#FCFAF8`;
- deep plum text `#1F1A24`;
- accessible petal connection accent, preferably `#AD5679` when white text is required;
- teal only for trust/safety confirmation;
- one consistent thin-line icon family;
- compact iOS-like spacing, restrained surfaces, minimal borders/shadows;
- full-bleed Discover media with a tested text-scrim/gradient and readable overlay content;
- no orange primary buttons;
- no Instagram copying—borrow familiar interaction grammar, not protected brand assets or an exact clone.

The palette is usable. The premium result will come from spacing, typography, density, hierarchy, motion, imagery, and consistent states—not another theme reset.

## Phased repair plan

### Phase 0 — baseline and safety

1. Freeze feature additions.
2. Inventory all 37 routes and create an acceptance matrix for state, back behavior, keyboard, width, font scale, and theme.
3. Add tests that reproduce the header interception, Date Plan keyboard coverage, edit hydration safety, interests minimum, direct public-profile lookup, offline auth, and debug signing/version mismatch.
4. Do not alter production/user data while reproducing defects; use deterministic fixtures and test accounts.

### Phase 1 — release identity and brand assets

1. Establish `DESIGN.md` as the single Yariva specification.
2. Replace raster/cropped branding with real mark/wordmark assets and one `YarivaBrand` component.
3. Configure independent legacy, adaptive, monochrome, and light/dark splash resources.
4. Perform a clean native rebuild, increment versionCode/versionName, and verify the package metadata.
5. Configure protected production signing; never sign release with `debug.keystore`.
6. Decide whether `com.aroha.mobile`, `aroha://`, `aroha.*` SecureStore keys, and `aroha-mobile` package naming are retained for compatibility or migrated. Migrate SecureStore keys safely.

### Phase 2 — shared UI foundation

1. Rebuild `TabHeader` as a measured, horizontal three-zone component.
2. Replace global palette mutation/root remount with immutable theme context and shared style factories.
3. Build and adopt six shells: tab, nested, form, conversation, media, modal.
4. Define one runtime bottom-navigation/inset contract consumed by lists, toasts, overlays, and keyboard pages.
5. Compact buttons, chips, settings rows, cards, and action tiles while preserving 44×44 dp effective touch areas.
6. Normalize typography families, line heights, truncation, and 200% font-scale behavior.
7. Normalize the icon family, optical sizes, stroke weights, active/inactive states, and accessibility labels.

### Phase 3 — critical flows and data safety

1. Add a direct authorized public-profile-by-ID API and explicit unavailable/blocked/deleted states.
2. Separate onboarding create mode from section edit mode; save only the selected section and return to the caller.
3. Block editing/saving until profile/preferences hydrate; add error/retry and dirty-leave confirmation.
4. Correct persisted-session/offline state handling.
5. Correct server/device session metadata and guard revocation.
6. Render real remote/local video and validate a two-device call lifecycle.
7. Implement coherent, rollback-safe privacy/communication state machines.

### Phase 4 — route completion and premium polish

1. Fix Date Plan date/time, keyboard, enrichment, fallback labels, budget formatting, and rescheduling.
2. Complete chat history/realtime/presence/receipts/attachments/scroll behavior.
3. Complete Activity error state, pagination, back behavior, actor identity, and navigation.
4. Add shared loading, empty, error, retry, offline, unauthorized, blocked, and deleted states everywhere.
5. Strengthen confirmations, modal semantics, double-submit protection, and urgent-safety pathways.
6. Tune Discover's full-bleed imagery, scrim, overlay typography, action rail, and compact bottom navigation after the shared geometry is stable.

### Phase 5 — release verification

1. Run TypeScript, ESLint, unit, component, navigation, API-state, and end-to-end tests.
2. Exercise all 37 routes through normal navigation and cold deep links.
3. Test 320/360/390/412 dp widths, tablet where supported, font scales 1.0/1.3/2.0, light/dark/system, gesture and three-button navigation, and Gboard/Samsung Keyboard.
4. For every data screen test loading, populated, legitimate empty, offline, timeout, 401, 403, 404, retry, and pagination.
5. For every mutation test double tap, server failure rollback, offline handling, and navigation during submission.
6. Run TalkBack traversal and verify one semantic target per control with at least 44×44 dp effective target.
7. Test real two-device voice/video calls.
8. Clean-build and fresh-install the signed APK/AAB; validate icon masks, themed icon, cold-start splash, version metadata, signing certificate, and size budget.

## Single copy-ready AI implementation prompt

```text
You are a senior React Native/Expo, TypeScript, NestJS, Android release, accessibility, QA automation, and premium consumer-product engineer. Work directly in this Yariva monorepo:

/Users/mohdghouse/Documents/Aroha

Primary mobile app:

/Users/mohdghouse/Documents/Aroha/frontend-mobile

GOAL

Make the installed Yariva mobile app genuinely production-ready. Fix the verified release, brand/icon, shared layout, overlapping UI, density, keyboard, navigation, data-safety, state-handling, chat, date-plan, settings, profile-edit, safety, and call defects listed below. Do not merely write a plan or redesign mockups: inspect the current implementation, reproduce the issues, implement the fixes in prioritized phases, test them, build a clean native Android release, install it on the connected physical phone, and verify the real flows as an end user.

PRODUCT TO PRESERVE

- Brand: Yariva.
- Dating-first app for verified adults in India, designed for meaningful romantic connections first, with friendship, activity partners, safe date plans, and real-world connection as secondary extensions.
- Preserve the photo-led, full-bleed Discover direction and familiar vertical social-feed interaction grammar, but do not clone Instagram, Tinder, Bumble, Hinge, Feeld, or their protected icons/assets.
- Keep the shared warm ivory / deep plum / restrained petal direction. Do not apply another arbitrary theme reset.
- No orange primary buttons.
- Use teal only for trust and safety confirmation.
- Use fallback/local AI behavior only where an external AI key is unavailable. Never expose internal copy such as “Fallback AI,” “no paid key,” provider names, debug labels, or implementation details to users.

NON-NEGOTIABLE ENGINEERING RULES

1. Do not duplicate pages, components, theme tokens, navigation logic, safe-area calculations, or platform branches.
2. Fix shared primitives first so every route inherits the correction.
3. Never use page-specific magic bottom padding such as 124 or fixed toast offsets as the layout contract.
4. Do not solve 44 dp accessibility by making every visual chip/button 44 dp tall. Keep compact visuals with a transparent 44×44 dp effective hit target/hitSlop.
5. Do not use exact fixed heights where text or font scale can grow. Use minHeight, adaptive padding, flex, truncation, and wrapping intentionally.
6. Do not mutate exported theme objects during render and do not remount the root/navigation tree to change themes.
7. Do not render a logo by cropping a larger raster image. Use canonical vector/native assets.
8. Do not patch only index.android.bundle for icon/splash/native/version/signing changes. Perform a clean native rebuild.
9. Preserve unrelated user changes and existing behavior unless it conflicts with a verified defect.
10. Do not silently swallow API errors or display false empty states. Every data route needs loading, content, legitimate empty, offline/error, unauthorized/blocked/not-found, retry, and pagination states as applicable.
11. Do not optimistically claim success unless the server succeeds or the UI can roll back/reconcile.
12. Destructive/safety actions require confirmation, busy state, double-submit prevention, error recovery, and accessible modal behavior.
13. Never clear or overwrite real profile/preferences when hydration fails.
14. Validate on real rendered screens and live interactions, not only TypeScript success or static screenshots.

VERIFIED P0 DEFECTS — FIX FIRST

1. `src/components/layout/TabHeader.tsx` is structurally broken: its row lacks `flexDirection: "row"`. Side actions stack below the title and overlap/intercept Discover cards, subtitles, segmented controls, lists, and the Profile hero. Rebuild it as a true three-zone horizontal header with equal constrained side zones and a mathematically centered title. Long city/location text must truncate. No collision at 320, 360, 390, or 412 dp and font scales 1.0, 1.3, or 2.0.

2. `android/app/build.gradle` signs `release` with the debug keystore. Configure production signing via secure environment/Gradle properties, fail a release build when release credentials are absent, keep secrets out of source, and prove with apksigner that the output is not `CN=Android Debug`.

3. `app.json` reuses opaque, off-center `assets/logo-square.png` as the app icon, Android adaptive foreground, and splash. Create/use a real canonical Yariva vector mark and wordmark, plus separate:
   - 1024×1024 opaque iOS/legacy icon;
   - 1024×1024 transparent Android adaptive foreground with safe-zone/optical centering;
   - Android monochrome foreground;
   - transparent light and dark native splash marks;
   - vector/native in-app mark and wordmarks.
   Remove the crop-ratio implementation in `ArohaMark.tsx` and replace it with one `YarivaBrand` API. Use deep plum background, ivory mark, and at most one restrained petal connection accent. Ensure no white rectangle in dark splash and a smooth OS-to-React transition.

4. Correct native metadata. The APK called v0.2.6 reports versionCode 1/versionName 0.1.0. Define a single release version source, increment it, clean prebuild/native resources, and verify with aapt. Decide deliberately whether legacy identifiers `com.aroha.mobile`, `aroha://`, `aroha.*`, and `aroha-mobile` remain for compatibility or migrate. If SecureStore keys change, migrate them without logging users out.

5. `ProfileDetailScreen` loads a requested person by searching the current eight-person Discover feed. Add/use an authorized direct public-profile-by-ID backend endpoint. Profiles opened from received likes, matches, Activity, old notifications, or deep links must load independently of Discover pagination/eligibility. Provide distinct blocked/deleted/unavailable/offline states and retry.

6. Profile quick actions reuse onboarding routes. Add explicit create/edit modes with a caller return route. Editing Interests, Schedule, Photos, Intent, Lifestyle, Discovery, or Communication must load successfully, edit/save only that section, and return to Profile/Review. It must never push the remaining onboarding chain or write defaults after a failed fetch.

7. `EditProfileScreen` needs a blocking hydration state, error/retry, save disabled until hydrated and dirty/valid, dirty-leave confirmation, guarded single photo upload, and working delete/reorder/make-primary controls. Fix keyboard scrolling so fields never move under the fixed header.

8. `AuthContext` must distinguish authoritative invalid/expired credentials from offline/timeout/server failure. Preserve a stored valid session in an authenticated-pending/offline state with retry. Clear tokens only after authoritative authentication rejection.

9. `ActiveCallScreen` acquires streams but renders only an avatar. Render remote video and local preview on supported native builds, reset timer/state per call ID, show audio fallback/errors, and only claim encryption/security capabilities that are actually verified. Test a real two-device incoming/outgoing voice and video lifecycle.

SHARED UI AND PREMIUM DENSITY

1. Replace mutable global theme palettes and root-key remounting with immutable light/dark theme objects delivered by context/hooks and theme-aware style factories. Theme switching must update in place without losing navigation, forms, scroll, keyboard, or open sheet state.

2. Use these canonical light tokens unless contrast testing requires a documented adjustment:
   - canvas: #FCFAF8
   - primary text/deep plum: #1F1A24
   - connection accent: #AD5679 when white text is used; #C86E91 may be used for large/decorative non-text accents
   - trust/safety teal: current restrained teal family only
   All normal essential text must reach 4.5:1 and interactive icons/boundaries 3:1.

3. Map typography to the real loaded Inter font files instead of relying on synthetic Android weights. Define compact, consistent title/body/caption/label line heights. Long names, city values, badges, and action labels must truncate/wrap without touching neighboring controls.

4. Create and adopt shared shells for:
   - primary tab screen;
   - nested page with back/title/action;
   - scrollable keyboard-safe form;
   - conversation/composer page;
   - full-screen media/profile page;
   - modal/bottom/center sheet.
   Eliminate duplicated SafeAreaView/padding/keyboard/bottom-clearance logic across routes.

5. Create one measured bottom-navigation contract used by tab content insets, scroll indicators, toasts, overlays, sheets, and keyboard behavior. The final item must always clear the dock under gesture navigation, three-button navigation, landscape where supported, and keyboard-open states.

6. Redesign the floating bottom navigation into a compact iOS-like Yariva dock using one thin-line icon family. Keep icon optical sizes/strokes consistent, provide clear active state, no bulky capsules/shadows, and accessible labels. Do not copy Instagram assets exactly.

7. Keep controls visually compact:
   - default buttons about 48–52 dp minimum where a full CTA is appropriate, not 60–73 dp;
   - chips/pills visually around 28–36 dp when text fits, with 44 dp transparent hit area;
   - settings/list rows normally 52–64 dp, growing only when secondary copy truly needs it;
   - icon buttons visually 32–40 dp with 44 dp effective targets;
   - consistent 8/12/16/20/24 spacing rhythm.

8. Make sheets responsive, internally scrollable, keyboard-safe on Android/iOS, rotation-aware, dismiss-safe while submitting, and accessible as modal focus scopes.

ROUTE/FUNCTIONAL FIXES

1. Discover:
   - preserve edge-to-edge/full-bleed profile media with no unnecessary left/right card gap;
   - use a tested scrim/gradient so name, locality, prompt, tags, and actions remain readable over light/dark photos;
   - keep a compact transparent action rail at lower right, with liked heart filling petal/red and clear success/error feedback;
   - make Filter a reliable header action; rebuild its center modal so Close never overlaps title/subtitle and content scrolls safely;
   - align onboarding and runtime age/distance ranges from one schema.

2. Connections/Activity:
   - fix header collision;
   - compact cards and keep the last row above the dock;
   - give Activity a shared centered header and Back action;
   - implement cursor pagination, explicit notification-type routing, actor avatar/identity, immediate navigation with background read reconciliation, and error/retry.

3. Chats/Conversation:
   - paginate older messages while preserving viewport;
   - scroll to bottom only when already near bottom or after local send;
   - derive presence from server state; do not fake a green live indicator;
   - initialize/read receipt sequences correctly;
   - exclude own messages from unread increments and reorder updated chats to the top;
   - open/download supported attachments with failure handling;
   - keep composer keyboard-safe and preserve unsent draft without accidental send;
   - make the options sheet compact, scroll-safe, and modal-accessible.

4. Match/Profile/Safety:
   - compact action tiles;
   - add confirmation and busy/error handling for unmatch, block, unblock, revoke, report, plan cancellation, and similar actions;
   - require explanatory detail when Report reason is Other;
   - validate route params and show safe unavailable states;
   - show recognizable identities in Blocked rather than UUID fragments.

5. Date Plans:
   - do not fail the plan list when optional match-name enrichment fails;
   - replace 2/3/7-day + fixed 5:30 PM choices with accessible date/time selection and timezone-safe values;
   - clear/mark stale suggestions after regeneration errors;
   - never expose AI-provider/fallback/key details;
   - use one cost formatter so flexible never renders ₹0–₹0;
   - implement a real reschedule proposal, not date +24h;
   - on Android, locality and CTA must remain visible above Samsung Keyboard and Gboard.

6. Onboarding/settings:
   - enforce the promised minimum of 5 interests from one shared schema;
   - make search cancellable/latest-wins with explicit request error state;
   - use full accessible day names while keeping the seven-day selector responsive at 320 dp;
   - make locality text and coordinates atomic;
   - replace contradictory Discoverable/Pause controls with one coherent visibility state machine;
   - serialize settings mutations, disable during save, roll back on failure, and reconcile server state;
   - correct session device/platform/current-device metadata and guard revocations.

7. Error/state completeness:
   Fix permanent skeletons, blank screens, and false-empty screens in My Profile, Match detail, Communication settings, Sessions, Blocked users, Activity, Photos, Review, and any other data route. Headers/back must remain available in every error state.

TEST AND RELEASE ACCEPTANCE — DO NOT CLAIM COMPLETE UNTIL ALL PASS

1. TypeScript, ESLint, unit, component, integration, navigation, API-state, and E2E suites pass.
2. Automated tests reproduce and prevent every P0 and P1 regression above.
3. All 37 Expo routes are exercised through normal navigation and cold deep links.
4. Android header Back, system Back, modal Close, and gesture Back return to the correct caller with and without prior history.
5. Layout passes at 320/360/390/412 dp, font scales 1.0/1.3/2.0, light/dark/system, gesture and three-button navigation, and Gboard/Samsung Keyboard.
6. Every fetch screen passes loading/content/true-empty/offline/timeout/401/403/404/retry/pagination cases.
7. Every mutation passes rapid double tap, server failure rollback, offline handling, and navigation-during-submit cases.
8. Complete onboarding, then edit every individual profile section. No unrelated step opens and no saved value resets.
9. Open public profiles successfully from Discover, received likes, matches, Activity, and cold links.
10. Chat passes older history, unread, receipts, typing, attachments, reconnect, ordering, draft, and scroll-preservation tests.
11. A real two-device voice and video call passes ringing, accept, decline, timeout, reconnect, mute, camera toggle, background/foreground, and end-call.
12. TalkBack traversal is logical; controls have one semantic focus target, accurate labels/states, and at least 44×44 dp effective targets.
13. Fresh uninstall/install of the clean native build shows the correct Yariva icon in circle, squircle, rounded-square, themed icon, app drawer, app info, and recents contexts.
14. Light/dark cold starts show no white box, old Aroha branding, old blue flash, or two-stage mark/wordmark jump.
15. aapt reports the intended version and apksigner reports a protected production certificate, never Android Debug.
16. Produce an APK/AAB size report. Meet the previously requested sub-30 MB user download/ABI target where technically feasible without removing required safety or call functionality; explain universal-APK versus split/AAB sizes precisely.

WORKING SEQUENCE AND REPORTING

1. Inspect repository instructions, current changes, route map, API contracts, and build scripts before editing.
2. Write a short implementation checklist grouped by P0/P1/P2, but continue immediately into implementation.
3. Add failing regression tests first for critical bugs where practical.
4. Fix in this order: release/brand identity → shared layout/theme/insets → data-safety/auth/profile lookup/editing → keyboard/forms/sheets → chat/date plans/settings/safety/calls → compact visual polish.
5. After each phase, run the narrow tests, then the full suite.
6. Clean-build, install on the connected physical Android phone, and exercise actual flows. Do not rely only on screenshots, static code review, or successful compilation.
7. Do not perform destructive actions on a real account. Use seeded QA accounts/fixtures for likes, messages, reports, blocks, unmatches, session revokes, plan mutations, and calls.
8. Finish with:
   - files changed and why;
   - P0/P1/P2 issue checklist with fixed/not-fixed status;
   - exact test/build/install commands and results;
   - APK/AAB path, version, signing verification, and measured sizes;
   - physical-device matrix completed;
   - remaining risks, if any.

Do not state that Yariva is production-ready while any P0 remains, while release is debug-signed, while icon/splash is not clean-native rebuilt, while a primary route can be intercepted/overlapped, or while real two-device call verification is missing.
```

