# Aroha — Product & UX Audit

**Date:** 4 May 2026
**Author:** Acting as senior PM / UX strategist
**Scope:** Frontend implementation vs Figma reference vs Aroha's intent-first vision (compared against Tinder, but explicitly NOT a Tinder clone).

---

## 0. Quick answers to your specific questions

Before the formal audit, the four things you asked about:

**0.1 "Profile setup pages are not implemented I guess"** — they are implemented. All ten onboarding screens exist as feature files: `BasicInfoScreen`, `BioScreen`, `IntentScreen`, `InterestsScreen`, `LifestyleScreen`, `ScheduleScreen`, `DiscoveryPreferencesScreen`, `CommunicationPreferencesScreen`, `PhotosScreen`, `ReviewScreen`. They're routed under `app/(onboarding)/`. You don't see them when you launch the app because your account already has a complete profile, so `AppLayout` skips onboarding. To re-test the flow, sign out and create a fresh account, or delete your profile data on the backend.

**0.2 "What's the difference between Matches and Chat? They look the same."** — they ARE the same screen right now. I just unified the Chat tab to point at `MatchesListScreen` because the Figma JSX (`chat.jsx > ScreenMatchesList`) only defines one combined screen for "new matches + ongoing conversations." This is a real product question, not just a wiring bug. Two options:

- **Drop one tab.** Go from 5 tabs → 4 tabs (Discover · Connections · Activity · Profile). Cleaner, fewer cognitive choices, and matches Aroha's "calmer" philosophy.
- **Differentiate purposes.** Matches tab = NEW matches waiting for first message + matches expiring soon. Chat tab = ongoing conversations only. This gives the new-match avatars more visual weight and creates a clear "do something" tab vs a "catch up" tab.

My recommendation is **drop the Chat tab and rename Matches → Connections** (more on this in §6).

**0.3 "Login and signup content I want middle"** — currently the auth forms are top-aligned with `paddingTop` (the heading sits roughly 1/4 down the screen). For a calmer brand feel, vertically center the form group between the safe-area top and the keyboard top. Quick fix: wrap form content in a `<View style={{ flex: 1, justifyContent: 'center' }}>` inside a `KeyboardAvoidingView`. Marked as P1 in the roadmap.

**0.4 "Check anything missing from the backend codebase features"** — I haven't audited the backend repo this session. What I can flag is which product features in this audit imply backend work (intent-weighted matching, daily new-people limit, conversation prompts, photo verification, etc.). Each is tagged below.

---

## 1. Aroha unique feature list (vs Tinder)

What makes Aroha different. These are the features the rest of the audit will test against.

### A. Matching philosophy
1. **Multi-intent matching** — a user can be looking for *Friendship*, *Companionship*, *Relationship*, *Shared interests* — separately or together. Tinder is single-purpose (dating).
2. **Intent-weighted compatibility** — the score that decides who you see should be driven by intent overlap and interest overlap, not just photo attractiveness.
3. **Slow by design** — copy already says *"Aroha matches slowly on purpose."* This is a brand promise that needs to be enforced in the system, not just stated.

### B. User profile depth
4. **Headline + bio** — long-form expression, not just photos.
5. **Lifestyle compatibility** — smoking, drinking, exercise, diet — the practical things that make relationships work.
6. **Schedule** — when the user is actually free (days + time-of-day). Practical for "find a gym partner" or "Saturday hike companion."
7. **Curated interest taxonomy** — interests are picked from a list (Things I do / Things I love), not free-form. Enables real interest-based matching.

### C. Discovery system
8. **Filter + rewind controls** — top bar of Discover. User can shape what they see.
9. **Empty-state widening** — when no new people, the prompt is *"Try widening your preferences"* not *"swipe more."*
10. **Distance + age preferences** — soft, not hard. User-adjustable.

### D. Conversation experience
11. **Suggested openers on new match** — *"What's been a small good moment this week?"*, *"Recommend me one thing — book, walk, anything."* — meaningful conversation starters.
12. **"Say something kind"** prompt on first message. Tone-setter.
13. **Attachment moderation** — photos/audio held for review before delivery. Calmer, safer.
14. **Read receipts as a user-controlled toggle** — not assumed.

### E. Safety & trust
15. **Photo moderation** — `PRIMARY` badge, *"Reviewing"*, *"Couldn't approve"* states.
16. **Per-match communication settings** — allow voice / video calls per individual match, not globally.
17. **Anonymous reporting** — *"the person isn't told either."*
18. **Account-paused state** — clear, calm copy with paused-feature chips (Discovery / Chat / Calls).
19. **Block confirmation modal** — friction before action.
20. **Consent-first calling** — *"You allowed Leo to call you"* as a system message.

### F. Emotional UX
21. **Calm visual system** — heartline-purple, soft gradients, generous whitespace, Fraunces serif on emotional moments.
22. **Quiet empty states** — *"Quiet for now."* / *"We'll let you know when something nice happens."*
23. **No streaks / points / counters** — no addictive mechanics.

### G. Community / interest-based connection
24. **Interest match badges** — surfaced on profile cards (`Shared interests`, `Friendship`).
25. **Curated interests with categories** — `THINGS I DO` vs `THINGS I LOVE` segmentation.

---

## 2. Feature implementation status

Legend: ✅ Implemented · ⚠️ Partial · ❌ Missing · 🚫 Wrong / Tinder-like

| # | Feature | Status | Notes |
|---|---|---|---|
| **A. Matching philosophy** | | | |
| 1 | Multi-intent matching | ✅ | `IntentScreen` lets user pick multiple intents. `IntentBadge` surfaces them on cards. |
| 2 | Intent-weighted compatibility scoring | ⚠️ | Frontend renders the result; backend weighting is opaque to the audit. **Backend work likely needed** — confirm `discoveryApi.feed` actually orders by intent overlap, not by recency or proximity. |
| 3 | Slow-by-design enforcement | 🚫 | Copy says it; system doesn't. No daily new-people cap, no cooldown, no "you've seen enough today." Without enforcement this is just marketing. |
| **B. Profile depth** | | | |
| 4 | Headline + bio | ✅ | `BioScreen` + `EditProfileScreen`. |
| 5 | Lifestyle compatibility | ✅ | `LifestyleScreen` (smoking, drinking, exercise, diet). |
| 6 | Schedule | ✅ | `ScheduleScreen` (days + time-of-day chips). |
| 7 | Curated interest taxonomy | ✅ | `InterestsScreen` with search + categories. |
| **C. Discovery** | | | |
| 8 | Filter + rewind controls | ⚠️ | Icons exist on `DiscoverScreen` top bar but neither is wired to anything. Filter sheet not built. Rewind has no API call. |
| 9 | Empty-state widening | ✅ | `DiscoverEmpty` with "Widen distance" CTA. |
| 10 | Distance + age preferences | ✅ | `DiscoveryPreferencesScreen`. |
| **D. Conversation** | | | |
| 11 | Suggested openers on new match | ✅ | `ChatEmpty` shows three suggested prompts. |
| 12 | "Say something kind" prompt | ✅ | Present in `ChatEmpty`. |
| 13 | Attachment moderation | ✅ | `ChatAttachment` shows reviewing / couldn't-send states. |
| 14 | Read receipts toggle | ✅ | `CommunicationSettingsScreen`. |
| **E. Safety** | | | |
| 15 | Photo moderation states | ✅ | Renders `PRIMARY`, `Reviewing`, `Couldn't approve`. |
| 16 | Per-match comm settings | ✅ | Just rebuilt in `MatchDetailScreen`. |
| 17 | Anonymous reporting | ✅ | `ReportScreen` copy. |
| 18 | Account-paused state | ✅ | `AccountRestrictedScreen` with paused-feature chips. |
| 19 | Block confirmation | ✅ | `BlockConfirmModal`. |
| 20 | Consent-first call system message | ⚠️ | UI shows "You allowed Leo to call you" copy on `IncomingCallScreen`, but the *granting* moment (per-match toggle) doesn't surface a system message in chat. Worth doing. |
| **F. Emotional UX** | | | |
| 21 | Calm visual system | ✅ | Heartline palette + Fraunces serif present throughout. |
| 22 | Quiet empty states | ✅ | Notifications empty: *"Quiet for now."* etc. |
| 23 | No streaks / points / counters | ✅ | None present. (Keep it that way.) |
| **G. Community** | | | |
| 24 | Interest match badges | ✅ | Rendered on `DiscoverCard`. |
| 25 | Curated categorized interests | ✅ | `InterestsScreen`. |
| **NEW (recommended)** | | | |
| 26 | Daily new-people limit | ❌ | E.g. 10 new profiles/day, then empty state. Enforces "slow." |
| 27 | Conversation prompt-of-the-day | ❌ | Beyond first message. Sustains meaningful chat. |
| 28 | Photo verification badge | ❌ | Trust signal beyond moderation. |
| 29 | Voice intro snippet on profile | ❌ | 15-sec voice clip — depth signal Tinder doesn't have. |
| 30 | Interest groups / circles | ❌ | Despite interest-first positioning, there's no group feature. Optional but high-leverage. |

---

## 3. Critical flow analysis

### Flow 1 — Onboarding
Steps: basics → bio → intent → interests → lifestyle → schedule → who-to-meet → reachability → photos → review. **Verdict: ✅ heavy on intent + interests.** Onboarding is one of Aroha's strongest assets — it forces users to articulate themselves before they get to swipe. Nine substantive steps before Discover unlocks is a strong filter against low-effort users (this is good).

One nit: the order. `Intent` is step 3 but arguably should be step 1 — it's the most defining choice and would frame everything that follows.

### Flow 2 — Discovery
Currently a swipe deck (X / Heart / Star) with peek of next card and big like-glow center button. **Verdict: 🚫 too Tinder-like in mechanic.** The *content* on the card (intent + interest badges) is on-brand, but the *mechanic* (rapid binary swipe) is the most addictive UX pattern in dating apps. The big glowing heart in the center is dopamine engineering.

Options:
- Keep swipe as one mode, add a second "browse list" mode for slower exploration.
- Replace single-card with a 2×2 grid where each card requires a tap to reveal full profile before liking.
- Remove the star (super-like) — it's a free-tier Tinder mechanic.
- Add a "no-thanks" friction prompt after every 5 passes ("Want to widen your preferences?").

### Flow 3 — Matching
Match-created moment uses Fraunces serif *"You matched."* with "Say something kind." copy. **Verdict: ✅ on-brand.** The match moment itself is well done. Risk: the photo still leads on the profile detail — consider showing intent + shared interests *above* the photo for compatibility-first framing.

### Flow 4 — Chat
Suggested openers ✅, attachment moderation ✅, gradient bubble for own messages ✅. **Verdict: ✅ but improvable.** What's missing: prompts beyond message #1. Consider:
- Daily prompt: *"Ask Leo about their Saturday list."*
- Conversation milestones: at 10 messages, suggest a low-stakes voice call.
- Kindness nudges: detect harsh tone client-side and offer a softer rewrite.

### Flow 5 — Calls
Per-match toggles + "You allowed X to call you" copy + decline/accept incoming. **Verdict: ✅ strong.** This is genuinely better than Tinder's free call-anytime model. One add: let the receiver send a quick decline reason ("Can we chat instead?") rather than just hanging up — keeps tone calm.

### Flow 6 — Profile
Photos + intent badges + bio + headline + schedule + lifestyle + interests + profile-completion ring. **Verdict: ✅ expressive.** Missing: voice intro, prompts (e.g. "I'm weirdly into __" with a one-line answer — these are signature Hinge features that work because they reveal personality without requiring long bios).

### Flow 7 — Safety
Block confirm + report (anonymous) + blocked-users list + account-paused + photo moderation + per-match call toggles. **Verdict: ✅ exceptionally strong** for a v1. Better than most consumer apps. Don't water this down for shipping speed.

---

## 4. Tinder-like behaviors detected

These are the patterns currently in the app that drift toward Tinder's playbook. None are catastrophic but each deserves a conscious decision.

| Pattern | Where | Severity | Why it matters |
|---|---|---|---|
| Single-card swipe deck | `DiscoverScreen` | 🚫 High | Most addictive UI in dating apps. Encourages volume over thought. |
| Big glowing center "Like" button | `DiscoverScreen` action row | 🚫 High | Pure dopamine engineering. The size + glow makes Like the path of least resistance. |
| Star / super-like | `DiscoverScreen` action row | ⚠️ Med | Tinder mechanic. Often paywalled. Doesn't fit Aroha tone. |
| Photo-first profile card | `DiscoverCard` | ⚠️ Med | Intent + interest badges are present but visually subordinate. |
| Match-count visible ("NEW · 4") | `MatchesListScreen` | ⚠️ Low | Counters can encourage volume thinking. Consider hiding number when ≤ 3. |
| No daily limit | System-wide | 🚫 High | "Slow by design" copy without slow-by-design system is hollow. |

What's NOT Tinder-like (keep these): the calm color palette, the Fraunces serif on emotional moments, the empty-state copy, the per-match consent model, the photo moderation, the anonymous reporting, the schedule + lifestyle depth.

---

## 5. Missing or weak areas

**Missing features essential to vision:**
- **Daily new-people cap** with calm exhaustion state. Without this, "slow" is just a slogan.
- **Conversation health features** beyond first-message prompts.
- **Photo verification** (selfie-match). Trust at scale.
- **Voice intro on profile.** Massive depth signal.
- **Profile prompts** (Hinge-style: 3 short answers to curated questions). Cheap to build, high signal.
- **Re-engagement that respects calm tone.** Not push-spam — weekly digest of "3 people who match your intent."

**Weak implementations:**
- Filter + rewind buttons on Discover are visual-only.
- Match-count badge encourages quantity thinking.
- Swipe deck mechanic conflicts with brand.
- Login/signup forms are top-aligned (you flagged this).
- Star/super-like has no purpose in Aroha — it's vestigial Tinder.

**UX flows misaligned with vision:**
- Discovery is the biggest one. The whole "fast binary swipe" model is the opposite of "meaningful connection." Even small mitigations (require tap-to-expand before like) would help.
- Match-detail leads with photo, not with shared interests.
- Activity tab mixes match notifications and message notifications — splitting them might encourage going to chat (slow, conversational) over going to Discover (fast, swipey).

---

## 6. Improvement roadmap

### Priority 1 — must fix before launch

1. **Decide tab structure.** Drop Chat tab. Rename Matches → "Connections". Reduces cognitive load and removes the duplicated screen. (1 day.)
2. **Vertically center auth forms.** Login + Signup. Quick UX polish. (2 hours.)
3. **Wire the Discover filter button to a real filter sheet** (intent + interest + lifestyle). Right now it's a dead icon. (2 days.)
4. **Remove the star (super-like).** It's Tinder DNA in an app that's not Tinder. Replace the third action button with a *"Save for later"* bookmark — non-notifying, non-dopamine. (1 day.)
5. **Daily new-people cap with calm exhaustion state.** Hard-code 12/day for v1. Backend enforces. Empty state: *"That's everyone for today. We'll find more tomorrow."* (3 days; backend + frontend.)
6. **Profile prompts (3 short answers).** Add a step to onboarding between Bio and Photos. Curated questions like *"A small thing that made my week"*, *"What I'm rereading"*, *"My ideal Sunday"*. (4 days; backend schema + frontend.)
7. **Backend audit pass** — confirm `discoveryApi.feed` orders by intent + interest overlap, not recency. If it doesn't, that's the single biggest hidden gap.

### Priority 2 — improve soon

8. **Photo verification flow.** Selfie-with-pose comparison. Verified badge on profile. (2 weeks.)
9. **Voice intro snippet (15-30 sec).** Optional profile field. (1 week.)
10. **Conversation prompt-of-the-day.** Backend job + chat surface. (1 week.)
11. **Reorder onboarding** so Intent is step 1. (1 day.)
12. **Discover redesign.** A/B: keep swipe vs introduce 2×2 browse grid. Measure on time-spent (lower is better) and message-rate-per-match (higher is better). (3 weeks.)
13. **Hide match counter when low.** "NEW" instead of "NEW · 1". (2 hours.)
14. **Match-detail layout — lead with shared interests, photo secondary.** (2 days.)

### Priority 3 — future enhancements

15. **Interest groups / circles** — small, opt-in, low-volume. *"Bengaluru weekend hikers — 47 people."* Massive differentiator vs every other dating app.
16. **Kindness nudges in chat** — client-side tone detection.
17. **Re-engagement digest** — weekly email/push with 3 high-compatibility profiles.
18. **Conversation milestones** — gentle prompts at 10/30/100 messages.
19. **"Pause for today" toggle** — user can self-impose a 24h cooldown. Calmness as feature.
20. **Privacy-preserving location** — show city not km on hidden-distance setting (already partially supported).

---

## 7. Backend feature implications

Things in this audit that imply backend work the user asked me to flag:

| Feature | Backend implication |
|---|---|
| Intent-weighted matching (#2) | Confirm scoring algorithm. Almost certainly needs revision if not already weighted. |
| Daily new-people cap (#26) | Per-user counter + reset job. |
| Conversation prompt-of-the-day (#27) | Cron + content store + delivery via existing realtime layer. |
| Photo verification (#28) | Selfie-pose comparison service (likely third-party). |
| Voice intro (#29) | New media type in profile schema + moderation. |
| Profile prompts (P1 #6) | Schema additions: `profile_prompts` (prompt_id, answer). |
| Filter sheet (P1 #3) | `discoveryApi.feed` needs to accept filter params (intent[], interest_ids[], lifestyle[]). |
| Match expiry (potential) | Decide: do unspoken matches expire after 7 days? If yes, scheduler. |
| Interest groups (P3 #15) | Whole new domain — out of scope until v2. |

---

## 8. Final takeaways

Aroha's strongest assets are:
1. **The vision.** Intent + interests + lifestyle + schedule is a real differentiator.
2. **Onboarding depth.** Nine substantive steps is a moat.
3. **Safety architecture.** Per-match consent + photo moderation + anonymous reporting is best-in-class for a v1.
4. **Visual + emotional UX.** The Fraunces serif moments, calm palette, and quiet copy are genuinely on-brand.

Aroha's biggest risks are:
1. **The swipe deck.** It's the loudest piece of Tinder DNA in the app and conflicts hardest with the brand.
2. **"Slow" without enforcement.** Words on a screen aren't enough — needs system-level slowness.
3. **Backend opacity.** If the matching algorithm is just proximity + recency, the whole intent-first promise collapses on contact with reality.
4. **Hollow buttons.** Filter, rewind, star — currently decorative.

If you fix the P1 list, Aroha ships as a recognizably distinct product. If you don't, it ships as a calmer-looking Tinder.
