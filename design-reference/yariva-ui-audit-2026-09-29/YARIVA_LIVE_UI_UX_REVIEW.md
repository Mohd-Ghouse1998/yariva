# Yariva live UI/UX review — 29 September 2026

## Verdict

Keep the existing visual foundation. Its warm neutral surfaces, charcoal actions, restrained champagne accent, Inter text and Space Grotesk display typography are coherent with the requested mobile_app_v3 direction. The current app needs a focused usability and consistency pass, not another brand or palette redesign.

It is not ready for a blanket “every page is premium, compact and confusion-free” sign-off. Concrete problems remain in Discover hierarchy, intent options, privacy promises, meetup grouping and input typography. These matter more than adding decorative effects. Gen Z attractiveness and ease of first use require testing with actual intended users; this audit cannot establish them.

## Method and limits

- Navigated the connected Samsung SM-G990E, package com.aroha.mobile, through its live UI using ADB, taps, scrolling and app deep links. Compared live accessibility text/control bounds with current implementation source and the actual mobile_app_v3 reference tokens.
- USB connection was online; wireless endpoint was offline. Metro was already running on 8081, backend on 3001. Neither was restarted.
- Phone viewport: 1080×2340 physical pixels at 480 density, approximately 360×780 logical units. Phone date confirmed 29 September 2026.
- Honored the user's no-image instruction for subsequent inspection. No images are retained in this audit. Evidence is text and Android hierarchy XML under live/. The initial pre-instruction screenshot was removed.
- Selected Dark and checked representative screens, then restored Light. Checked Photos, Discovery Preferences and Bio at Android font scale 1.3, then restored 1.0. Finished on Profile.
- Read-only inspection: no messages, calls, invitations, reports, renewals, profile edits, bookings, blocks, revocations or logout were submitted. Opening chats may update ordinary read state.
- Hierarchy bounds prove structural placement and reachability, not actual rendered font shape, photo quality/cropping, color contrast, motion smoothness or pixel-level polish. Offscreen children in a scroll view are not automatically clipping defects. Dark selection was verified; dark pixel appearance was not.
- Authentication, first-time onboarding, genuine incoming/active calls and several conditional states were not exercised live. Source inspection is explicitly distinguished below. No application code was changed or regression suite run for this review.

## Coverage

| Area | Live inspection | Remaining limit |
| --- | --- | --- |
| Discover | Header, Scenes entry, active Duo entry, Blind Vibe entry, first profile, scroll, Like/Skip controls, filter modal | No interest/skip submitted; active Scene viewer/composer not entered because the existing Scene was expired |
| Full Profile | Nandini's identity, compatibility explanation, bio, prompts, interests, lifestyle, languages, optional values, persistent decision footer; scrolled through page | Decision submissions and private/locked variations not exercised |
| Connections | Interested-in-you empty state, Matches list, connection detail for Kabir | Incoming-interest acceptance, unmatch and preference mutations not exercised |
| Chats | List, solo Meera chat, keyboard opening/dismissal, options menu; Duo chat/options; existing revealed Blind Vibe chat | No new message/media/call sent; unrevealed state reviewed in source |
| Meetups | Upcoming list, existing confirmed solo plan, expanded Safety tools; solo plan composer with venue categories/results/time presets | Pending/Past tabs, search queries, accept/counter/cancel/check-in/share and navigation into external Maps not exercised |
| Duo | Connected Duo page with existing Scene approval action; four-person chat; confirmed Duo meetup showing all four approvals | Pending invitation, pair discovery and acceptance transitions not exercised |
| Blind Vibe | Current upcoming event, left-event/Join again state; revealed chat banner | Join consent, live-event discovery and mutual reveal transitions not exercised |
| Vibe | Live recording studio and its recording/music/effect/mute/flip controls | No recording or upload; effects and playback states reviewed only in source |
| Profile | Dashboard, grouped Edit Profile hub; Basic details, Bio, Photos, Interests, Lifestyle, Looking for, Discovery Preferences, Usually free, Languages & values, Conversation starters | Photo management actions, choice/editor dialogs and save/discard transitions not submitted |
| Settings | Index, Appearance, Privacy, Communication, Blocked empty state, Devices & sessions, Language & tone | No privacy/communication/language changes, unblock, session revoke or logout |
| Activity and safety | Activity list; Report form and reasons | No report submitted; blocked/restricted outcomes not triggered |
| Auth/onboarding | Route inventory and shared source inspection of Welcome/Login/Signup/OTP, onboarding intro/review and shared profile form components | Not a live onboarding or authentication sign-off |
| Calls and match celebration | Source inspection of call shell/incoming/active and match-created screen | No actual call or new match event generated |
| Private recap/streak UI | Tracker checked | Not yet implemented on this installed mobile build; cannot audit a nonexistent screen |

The evidence folder contains 53 named state snapshots. Some earlier full-profile attempts remained on Discover; use full-profile-retry and profile-detail-middle/bottom for the actual detail screen. State snapshots are not a claim that 53 separate pages were fully verified.

## Findings and fixes

### UX-01 — Privacy promise needs proof before it is presented as protection (P0)

Live Privacy shows “Hide from contacts” and “Hide from uploaded contacts.” The source search found the boolean being stored and returned, but no contact import, hashed contact exclusion or discovery enforcement path in the inspected backend/mobile source. A saved preference does not itself protect someone from being discovered by contacts.

Example: a closeted user enables this expecting family or colleagues to be excluded.

Fix: trace the whole implementation and verify exclusion across relevant discovery surfaces. If it is unsupported, remove the actionable toggle from normal UI or clearly present it as unavailable, without deleting persisted data. Do not silently treat it as working. This audit does not establish a live disclosure incident; it establishes an unverified promise that must not receive sign-off.

Source: frontend-mobile/src/features/settings/PrivacySettingsScreen.tsx; privacySettings.ts; aroha_backend/src/modules/profiles/application/profiles.services.ts; profiles.mappers.ts; aroha_backend/prisma/schema.prisma.

### UX-02 — Three different intent vocabularies create confusion and possible data loss (P1)

- Looking for offers Intentional dating, Committed relationship and Marriage-minded.
- Discover filters offer Friendship, Shared interests, Companionship and Relationship.
- Discovery Preferences exposes all seven enum values with mechanically formatted, lower-case labels.

IntentScreen hydrates only its three supported values and then saves that selected set. An existing supported friendship/companionship intent could therefore be dropped when a user edits this screen. Do not test that against a real profile during an audit.

Fix: reconcile supported backend meanings and product decisions, then share typed option definitions and display labels across these surfaces. A profile's own intent and the intents sought in others are separate settings, but their labels and meanings must agree. Preserve existing supported selections, distinguish daily Scene intent from persistent profile intent, and make any genuine limitation explicit.

Source: frontend-mobile/src/features/profileSetup/IntentScreen.tsx; DiscoveryPreferencesScreen.tsx; frontend-mobile/src/features/discovery/DiscoveryFilterSheet.tsx; frontend-mobile/src/types/enums.ts.

### UX-03 — Discover gives secondary features too much initial space (P1)

On the checked 360dp-wide phone, Scenes, Duo and Blind Vibe appear before the first profile. The first profile's title appears near the bottom of the available feed viewport; Like/Skip require scrolling. The controls become reachable after scrolling, so this is hierarchy friction, not evidence of an inaccessible button.

Fix: compact the existing feature entries into a clearly labeled, theme-consistent treatment, keep state messages readable and give the person and primary decision more prominence. Preserve access to every feature and existing business rules. Achieve this through layout and progressive disclosure, not tiny fonts or automatic hiding of essential actions.

Source: frontend-mobile/src/features/discovery/DiscoverScreen.tsx; frontend-mobile/src/features/scenes/ScenesPanel.tsx; WingmanEntry.tsx; BlindEntry.tsx. Evidence: live/discover-scrolled.json; initial bounds are also recorded in the original root dump history, with the source confirming header ordering.

### UX-04 — A past confirmed plan appears under Upcoming (P1)

Live Meetups shows “Public art and coffee,” confirmed for Thursday 24 September at 4:44 pm, under Upcoming on Tuesday 29 September. DatePlansScreen groups all ACCEPTED plans as Upcoming and groups Past by status alone.

Fix: use the actual scheduled time/duration and an agreed display policy for elapsed confirmed plans. An elapsed plan may need a “Follow up” or past-confirmed state; do not automatically record it as attended or completed. Keep server status distinct from time-based display grouping. Include timezone, clock/resume refresh, boundary and cancellation cases.

Source: frontend-mobile/src/features/datePlans/DatePlansScreen.tsx; frontend-mobile/src/types/datePlan.ts. Evidence: live/date-plans.json; meetup-detail.json.

### UX-05 — “My Scene” can republish an expired Scene without a clear committing step (P1)

The live visible tile says “My Scene”; its accessibility action says “Renew scene.” ScenesPanel.openMine calls the renewal API immediately for an existing expired Scene. This audit did not tap it or renew anything.

Example: someone taps to inspect yesterday's plan and accidentally broadcasts that they are available again.

Fix: show the expired state and an explicit Renew Scene action. Let the user review the old activity/availability and deliberately confirm renewal. Reuse the existing composer/confirmation pattern and retain expiration, trusted activity and reward rules.

Source: frontend-mobile/src/features/scenes/ScenesPanel.tsx, openMine/renew/MineTile.

### UX-06 — Chat and Report text fields bypass the shared font (P1)

ChatScreen's TextInput uses a 14-point style with no fontFamily; ReportScreen's details input also omits fontFamily. The shared Input uses Inter. SceneViewer's reply field already spreads typography.body and is not the same defect.

Fix: reuse shared input typography or an appropriate existing field primitive without breaking the specialized chat composer. Preserve multiline growth, selection, keyboard behavior, errors and screen-reader labels. Essential message/bio reading text should remain legible at the existing 15–16 scale where appropriate.

Source: frontend-mobile/src/features/chat/ChatScreen.tsx, input style; frontend-mobile/src/features/safety/ReportScreen.tsx, textarea style; frontend-mobile/src/components/ui/Input.tsx.

### UX-07 — Several compact targets miss the project's 48dp contract (P1)

Source and live bounds show 44dp tab targets, 34dp segments, 44dp interactive chip targets and 40dp schedule-day targets. Those components do not provide the shared Button/IconButton's equivalent expanded 48dp hit area. Compact visuals are fine; small interaction regions need correction.

Fix: provide at least 48dp effective, nonoverlapping touch targets while retaining compact visible geometry. For the seven-day selector, wrap/reflow if seven safe targets do not fit. Do not solve it with overlapping hitSlop. Test dynamic text, target separation and tab content clearance.

Source: frontend-mobile/src/components/navigation/FloatingTabBar.tsx; frontend-mobile/src/components/dating/SegmentedControl.tsx; frontend-mobile/src/components/ui/Chip.tsx; frontend-mobile/src/features/profileSetup/ScheduleScreen.tsx. The 48dp contract is in the existing master prompt and controlSize.minimumTouchTarget.

### UX-08 — Full Profile and navigation labels need clearer human wording (P2)

Full Profile shows lifestyle values such as WEEKLY, OMNIVORE and BALANCED without their field labels. “Weekly” does not explain what happens weekly. Some optional value headings are mechanically humanized, such as “Religion spirituality.” Navigation uses Connect/Connections and Meet/Meetups; Activity notifications still refer to Wingman while current entry pages say Duo.

Fix: use concise semantic labels, for example “Exercise · Weekly,” “Diet · Omnivore” and “Social energy · Balanced.” Use a single approved naming map across visible navigation, screen titles, notifications and accessibility labels. Compact tab labels may remain shorter if meaning is clear; do not cram long text into the dock. Keep internal Wingman identifiers where compatibility requires them.

Source: frontend-mobile/src/features/discovery/ProfileDetailScreen.tsx; FloatingTabBar.tsx; NotificationsScreen.tsx; current backend notification templates. Evidence: profile-detail-middle.json; connections.json; notifications.json.

### UX-09 — Existing profile polish should be refined conservatively (P2)

The Profile/My Vibe description is long for a one-line compact row. Shorten it, for example “Your 5-second video intro,” after confirming supported media terminology. Avoid ellipsis for important instructions. Whitespace below a short Profile menu is not itself a defect: do not fill it with redundant navigation or invented content.

Keep the recent single-owner navigation fix: Profile has My Vibe and Edit profile with one Settings gear; Photos, Interests, Looking for and Usually free belong inside Edit profile; Privacy and Log out belong in Settings.

## Working direction

1. Verify/remove the unsupported privacy promise and reconcile intent semantics first.
2. Fix past/upcoming grouping and explicit Scene renewal behavior.
3. Improve Discover hierarchy, input typography and safe touch areas through shared components.
4. Apply concise copy/naming polish. Recheck every affected flow on the phone through Metro, without screenshots.
5. Keep remaining states honestly pending until exercised with safe test accounts. No full-device, iOS, contrast, smoothness or Gen Z preference claim from this audit.

Current implementation tracker reports six of seven active features complete and recent PROFILE-UX-01/02 complete. P6 recap/mobile/export work and final QA remain pending. This review does not reset that tracker or reintroduce removed FEATURE-F/escrow. Read the latest tracker before implementing because the other chat may continue changing the shared workspace.
