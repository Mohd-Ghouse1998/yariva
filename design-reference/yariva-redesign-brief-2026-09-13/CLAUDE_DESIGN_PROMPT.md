# Yariva — complete redesign prompt for Claude Design

Copy everything below the divider into Claude Design. The companion `YARIVA_FEATURE_MAP.md` provides code references and the REST/route inventory if you want to attach it too. This prompt is self-contained; attaching it does not grant access to your local repository.

---

Act as a senior product designer, UX architect, brand designer, and Figma design-system specialist. Create a completely new UI/UX for **Yariva**, an existing mobile dating app formerly named Aroha.

I dislike the existing interface. This is a full redesign of the information hierarchy, screen composition, interaction patterns, navigation presentation, typography, and visual identity. Do not reproduce the old layouts with different colors. Preserve the real product capabilities and business rules described here. Use **Yariva** in every user-facing frame, notification, and piece of copy.

The primary deliverable is an editable, high-fidelity mobile design with a reusable Figma component system and connected prototype flows. A separate desktop admin console is secondary. Do not produce just a landing page, a moodboard, a few attractive home screens, or a code-only implementation. If your environment cannot create a Figma file directly, state that clearly and produce the closest editable design artifact and a precise Figma handoff. Do not claim that a Figma file exists unless it does.

## 1. Product and audience

Yariva is an India-first dating product for adults, focused on compatible people moving from an honest profile to a mutual connection and a real public date. Use inclusive adult profiles, realistic Indian names and locations, ₹ examples with currency support, local date/time presentation, and varied genders and relationship intentions. Do not assume that everyone wants marriage or a heterosexual relationship.

The central journey is:

**Create an intentional profile → explore a curated selection → express interest privately → mutually match → talk or call → agree on a date → check in privately → reveal mutual interest in meeting again.**

The experience should feel attractive, contemporary, human, and easy to understand. Emphasize curiosity, mutual choice, and clear next steps. The product must support the full journey without pressuring people to match, respond, call, or meet.

The backend is NestJS/TypeScript with PostgreSQL/Prisma, REST, Socket.IO, media uploads, and background jobs. The existing mobile app uses React Native, Expo, and Expo Router. Use these facts for feasibility; do not put infrastructure terminology in the consumer UI.

## 2. Creative direction

Develop a distinctive new visual language. Existing Aroha/Yariva screen layouts and old ivory/rose/teal tokens are historical context, not a constraint for this redesign.

My suggested starting direction is **modern editorial warmth**: a warm porcelain canvas, a deep ink-blue or forest anchor, a controlled persimmon or citrus accent, expressive but highly legible typography, generous photography, and clear compositions with breathing room. Treat this as a design proposal, not an existing brand requirement. You may improve it if another direction better serves Yariva.

Create three genuinely different mini-directions using the same Discover and Date Plan content so the differences in hierarchy and layout are visible. Recommend the strongest and develop it into the complete system; do not stop after presenting options unless I explicitly ask to choose first.

Requirements:

- Make people, their personality, and their intentions the visual focus. Use realistic adult photography with consistent crops and varied representation.
- Use an expressive display treatment sparingly and a clear text face for reading, forms, and conversations. Specify the actual chosen fonts and accessible fallbacks.
- Establish recognizable Yariva details in profile presentation, mutual-match moments, and date invitations. Avoid making every surface a rounded rectangle with chips.
- Use a disciplined spacing scale, a small set of radii, consistent icon strokes, and semantic color roles. Define actual tokens after choosing the direction.
- Create thoughtful light and dark themes. Dark mode must have its own tested surface and contrast hierarchy.
- Explore an updated wordmark and a compact app mark. The existing brand idea of two paths meeting is optional inspiration. A logo redesign must be labeled as proposed, not silently treated as an approved identity.
- Avoid generic dating-app imitation, giant swipe buttons, endless swipe decks, neon nightclub styling, excessive gradients, glass effects, infantilizing illustrations, and decorative dashboards.
- Express quality through composition, typography, imagery, and interaction clarity. Do not add a premium subscription or payment flow: there is no billing backend.

## 3. Information architecture

Start from these five destination responsibilities. You may improve names, order, and presentation if you explain the rationale and preserve every destination's function:

1. **Discover:** curated people, filters, full profiles, private interest, pass/undo.
2. **Connections:** incoming interests and mutual matches; new connections that have not started a conversation.
3. **Chats:** conversation inbox and ongoing direct conversations.
4. **Plans:** pending invitations, accepted dates, and past plans.
5. **You / Profile:** profile preview, completion, editing, preferences, privacy, safety, account settings.

Use contextual links between match, chat, and date plan rather than duplicating the same list across tabs. Give notifications a consistent entry point. Keep essential destinations visible and labels understandable. Support route entry from a notification, a restored session, and an unavailable or ended match.

## 4. Authentication and onboarding

Design launch/session restoration, welcome, create account, sign in, expired session, and account-restriction states.

Current authentication supports email and/or phone plus a password; login uses an email-or-phone identifier and password. Password policy is 10–72 characters. There is no implemented OTP, Apple/Google sign-in, password reset, change-password, self-service account deletion, or identity-verification submission flow. Put proposals for those on a separate future-work page, with dependency notes; do not show them as working actions in the current prototype.

Reduce onboarding effort using short, focused steps with meaningful progress, inline validation, saved server state, clear back navigation, and a review screen. Distinguish required information from optional profile enrichment. A person must be 18 or older.

The actual discovery completion requirements are:

- Display name, at least 2 trimmed characters and at most 80.
- Bio, 20–1,000 characters.
- Date of birth and age eligibility.
- City, region, country, and resolved location coordinates. Coordinates/geohash belong to implementation, not a form the user should type into.
- At least one connection intent.
- At least one approved profile photo, including an approved primary photo.
- Valid discovery preferences: minimum age 18+, maximum age not below minimum, and positive distance range.
- A saved communication-preferences record.
- Active account and a profile that is not hidden. Pausing also prevents discovery access.

**Interests, lifestyle, availability, prompts, and sensitive compatibility fields are not completion gates in the backend.** Offer optional enrichment at sensible moments instead of forcing a lengthy questionnaire before discovery. Do not confuse photo moderation with identity verification.

Include the following profile information, grouped into understandable sections:

- Basics: display name, date of birth, gender, pronouns, city/region/country, headline up to 140 characters, and bio.
- Gender choices: Woman, Man, Non-binary, Trans woman, Trans man, Agender, Other, Prefer not to say.
- Intent choices: Dating, Committed relationship, Marriage-minded, Relationship, Friendship, Companionship, Shared interests. Dating is the main product positioning, but retain the other supported intentions as accessible choices.
- Relationship pace: Slow and steady, Open to exploring, Intentional, Ready to commit.
- Interests from a categorized catalog with multi-selection; local filtering of the loaded catalog is fine.
- Lifestyle: smoking, drinking, exercise, diet, pets, sleep pattern, and social energy. Respect available “Prefer not to say” options.
- Availability: days, time blocks, weekend preference, remote-friendly preference, maximum meetups per week, preferred planning lead time, and timezone. Put bitmask implementation details only in handoff notes. Time-block labels need reconciliation with backend mappings; do not claim the old UI labels are authoritative.
- Languages and food preferences, up to 10 entries each.
- Optional compatibility information: relocation openness, career priority, comfort with family involvement, marriage timeline, children preference, religion/spirituality. Sharing is opt-in via the supported sharing toggle. Never infer these traits from a photograph or name.
- Up to three prompt answers, maximum 500 characters each. Supported prompts: “My ideal unhurried Sunday…”, “Something I would love to learn with someone…”, “A relationship feels healthy to me when…”, “A small thing that made my week…”, and “The quickest way to make me laugh…”.

Photo management supports upload, reorder, set primary, and delete. Supported files are JPEG, PNG, and WebP up to 10 MB. Show upload progress, failure/retry, pending review, approved, rejected with available reason, and primary-photo selection. Do not invent a fixed photo count as a backend restriction. Pending/rejected photos cannot become primary. Show a truthful waiting state if the approved-photo requirement is still missing.

Ask for location, camera, microphone, media-library, and notification permission in context. Include denied permission and settings recovery. Do not imply that entering only a city is sufficient for location-based discovery without a location-resolution implementation.

## 5. Discovery and public profiles

Design a finite, thoughtful browsing experience. Current code caps a curated snapshot at **up to eight profiles**, with 24-hour snapshot expiry. This is not a verified midnight quota reset. Drive availability copy from returned state; do not invent countdowns, infinite candidates, paid boosts, or unlimited refresh.

A discovery preview should communicate the person's photo, name, visible age/location, intent, a short personality detail, and one or two useful reasons to look closer. Keep detailed compatibility in the full profile rather than crowding every card.

Full profile content can include photo gallery, headline/bio, pronouns, intents, relationship pace, prompt answers, interests, lifestyle, languages, food preferences, shared interests, schedule overlap, and optional publicly shared compatibility information.

The backend supplies a heuristic compatibility score and reasons. Prefer understandable reasons such as shared interests and overlapping availability. Do not present the score as a scientific prediction, a safety score, or a probability of relationship success. Do not expose the internal trust score in the consumer app.

Support filters for age, preferred genders, distance, intentions, recently active, and same-city preference. Same-city is a ranking preference, not a strict boundary. The recently-active toggle is stored, but its selection is not applied by the current discovery query. The backend can widen distance/activity search when no candidates are found. Annotate this implementation gap and avoid promises of strict filtering that the current behavior cannot support.

Actions:

- Open complete profile.
- Express interest, with a confirmation sheet and an optional private introduction up to 300 characters.
- Send without a note.
- Pass / “Not for me” with an Undo action.
- Retract interest where the current relationship state allows it. Retraction is not a substitute for unmatching; use the unmatch flow for an existing match.
- Report or block from a clear overflow menu.

Show interest-sent, mutual-match, expired/unavailable profile, no results, selection exhausted, loading, offline, and recoverable-error states. Hidden age/distance and unshared sensitive fields must be omitted. Do not reveal exact coordinates or private account contact details.

## 6. Connections and matches

Design incoming-interest cards with the sender's photo/name, available location/intent information, received time, and private introduction. Allow opening the full profile and reciprocating interest. Do not assume a dedicated incoming-like rejection/delete endpoint exists.

Keep incoming interests distinct from confirmed mutual matches. A match celebration should be warm and brief, with “Start a conversation” and a clear return path. Avoid fake urgency.

Match detail should link to profile, chat, and planning a date. Include per-match voice-call permission, video-call permission, mute, unmatch, block, and report. Both people's permissions affect whether a call is possible. Show new matches without messages and active conversations without duplicating Chats.

Unmatching ends the relationship and closes its conversation; blocking also stops interaction and cancels active plans. Unblocking does not restore the old match or conversation. Explain consequences before destructive actions. Show a neutral unavailable state without identifying who blocked whom.

There is no paginated sent-likes-history endpoint. Do not invent a complete “All interests sent” screen unless clearly labeled as a backend addition.

## 7. Messaging

Design the inbox with names, photos, latest message, timestamp, unread count, and useful empty/loading/error states. Chat includes header/profile access, history, composer, keyboard states, text messages, media, typing/presence when supplied, and contextual access to calls and date planning.

Backend-supported message features:

- Text up to 5,000 characters.
- Reply-to references.
- Edit the sender's text messages within 15 minutes.
- Delete the sender's own messages.
- Image, video, and audio attachments. Image/audio maximum is 15 MB; video maximum is 50 MB.
- Attachment upload and moderation, including pending, approved, rejected/removed states.
- Read position/unread counts and read-receipt preferences.
- System messages for relationship/date-plan events.
- Socket-based updates, reconnect, and history reload.

Text and image sending are represented in the current chat screen. Video/audio composition, reply/edit/delete controls, and rich media playback need additional frontend work even though backend contracts exist. Design them and mark that work in annotations. Voice-note recording is a proposed client capability, not an existing recorder.

Show sending, sent-to-server, failed/retry, and read only where supported. Do not invent a device-delivery receipt or always-online state. Show neutral placeholders for removed messages and unavailable attachments; do not expose moderated content in previews or replies. Include a closed-conversation state with an appropriate disabled composer.

Do not add reactions, GIF search, public comments, group chat, message search, disappearing messages, or an AI dating coach as current features. Do not label the chat “end-to-end encrypted” based on existing interface copy alone.

## 8. Voice and video calls

Design incoming voice/video call, outgoing ringing, accepting, connecting, connected voice, connected video with remote view and local preview, declined, canceled, missed, timeout/failure, permission denied, accepted on another device, and ended states.

Provide appropriate mute, camera, end-call, and return-to-chat controls. Audio routing, camera switching, and native video rendering are frontend integration tasks and must be annotated where proposed. The current screen does not render a complete native remote-video experience.

Calls require an active relationship and compatible global and per-match permissions. Support permission revocation, unmatch, and block ending a call. Do not add a standalone call-history destination: no call-history list endpoint was found. Missed calls can surface through existing notifications.

## 9. Date planning — the signature product experience

Make planning a date one of Yariva's strongest and most distinctive flows. It must feel collaborative and easy.

Entry points: active match detail, conversation, and Plans. When entering from Plans without a match, choose an active match first.

Design both assisted suggestions and a manual proposal path supported by the creation endpoint. The manual path is a redesigned client flow, not a currently complete composer.

Suggestions use:

- Public locality.
- Preferred future date/time and timezone.
- Duration from 45 to 360 minutes.
- Budget minimum/maximum, 0–100,000, with INR as the default currency.
- Atmosphere: Calm, Playful, Creative, Outdoorsy, Food & conversation.
- Existing shared interests and schedule overlap.

Suggestion cards include title, short description, activity, timing, duration, approximate cost range, locality, reasons it fits, and a safety note. Support generation loading, retry, suggestions unavailable, and fallback ideas. Keep provider names and technical fallback terminology in annotations, not consumer copy. If inputs change, show that previous suggestions need refreshing.

Suggestions are activity ideas; there is no integrated venue inventory, verified-venue registry, live pricing, booking, payment, or calendar-sync service. Use estimated costs and fictional sample places. Do not claim a restaurant is booked, open, vetted, or available.

Allow review/edit before sending: title up to 140 characters, description up to 1,000, activity type, future time, duration, timezone, public locality, estimated costs/currency, and optional venue name/address. Coordinate fields are implementation details.

Date-plan states and behavior:

- Creation sends a **Proposed** plan and records the creator's acceptance of that proposal version.
- The other person can accept, decline, or propose a change.
- A counterproposal creates a new version and invalidates old-version acceptance; the counterproposer accepts the new version by sending it, and the other person must accept that version.
- The plan becomes **Accepted** only after both accept the current version.
- Exact venue details are returned only after mutual acceptance and remain available for completed accepted plans. Before then, show public locality and a clear explanation of when details become visible. Do not embed the exact address elsewhere in preview copy.
- The current counter endpoint accepts changes only while Proposed/Countered. Do not offer an already-confirmed plan a working “Reschedule” action through that endpoint. Use cancel-and-propose-another or annotate a required backend change.
- Pending or accepted plans can be canceled. Accepted plans can be marked completed.
- Declined, canceled, and completed plans belong in history.
- `DRAFT` exists in the model, but no save-draft endpoint was found. If a local draft is designed, label its local-only behavior in handoff notes.

Plans should distinguish pending action, waiting for the other person, upcoming accepted dates, and past plans. Use clear version-aware acceptance summaries, timezones, and cancellation explanations. Include concurrent-change/conflict recovery so users refresh an outdated proposal instead of accidentally acting on it.

## 10. Check-ins, safety, and meeting again

Date check-ins support **Arrived**, **I'm okay**, **I need help**, and **Left early**. These are private from the date partner. The current backend records a safety status; it does not dispatch an emergency response or automatically alert a trusted contact.

Design honest confirmation copy. Keep a separate, intentional native phone action for local emergency help. The current client also opens the system share sheet to share a plan with a trusted person; this is manual sharing, not continuous tracking or an automatic contact-alert system.

After a completed date, ask privately whether the person wants to meet again. When both say yes, show the mutual outcome. Otherwise show a neutral saved/waiting state. Never expose the other person's individual answer or suggest that they said no. Despite a broader DTO union, the implemented privacy function returns only a mutual result or no result.

General safety flows:

- Block confirmation, blocked-users list, unblock confirmation.
- Report a user, message, profile photo, conversation, match, or call.
- Report reasons: Spam, Harassment, Inappropriate content, Fake profile, Underage, Safety risk, Other.
- Optional description up to 2,000 characters; contextual target attached automatically where possible.
- Submission success, duplicate-report acknowledgment, failure/retry, and a report-history view using the existing “my reports” endpoint.
- Report statuses: Open, Under review, Actioned, Closed, Duplicate.
- Account states: Restricted, Suspended, Banned, Deleted; also contextual freezes of discovery, chat, and calls. Use user-understandable copy rather than revealing internal enforcement signals.

A general Safety Center, appeal flow, or live support chat is not currently implemented. A new safety hub that links existing block/report/check-in tools is a proposed client grouping; editorial advice/support functions need separate scope. Profile verification status exists, but there is no selfie/KYC submission workflow. Never invent a verification CTA that appears functional.

## 11. Profile, settings, notifications, and devices

Design my profile as a useful preview and editing hub. Include required-completion status, optional enrichment, photo management, prompt editing, intentions/pace, preferences, and the full profile content listed earlier. Do not imply that optional fields are mandatory.

Settings cover:

- Visible / Paused / Hidden profile state.
- Hide age, hide distance, sensitive-information sharing.
- Incognito: current discovery excludes these profiles; existing relationship access can still allow profile viewing. Avoid overpromising the exact audience.
- Hide from contacts: field and UI exist, but no contact-matching enforcement was found. Put this in the dependency page, not as an effective protection in the current flow.
- Global voice/video-call permissions.
- Read receipts.
- Push preferences for matches, messages, and calls.
- Light, Dark, System appearance; this is a local client preference.
- Devices and sessions: device/platform, current-device indicator, last active, revoke another session, revoke all others, and current-session logout. Handle a revoked/expired session gracefully.
- Blocked users, reports, and safety entry points.

Notification types include new interest, new match, new message, missed call, date proposed/accepted/changed/canceled, date reminder, safety check-in reminder, mutual meet-again, report update, moderation notice, and system notice. Design read/unread states and context-aware navigation, including missing/inaccessible targets. Mark a notification read individually; there is no bulk mark-all-read endpoint.

In-app notifications and push-token storage exist. Actual external push sending is a logging stub, so push delivery needs integration. Include OS permission states, but do not claim production push is already functioning.

## 12. Separate admin console

After the consumer journey is complete, design a restrained desktop operations console on separate pages. No admin destinations belong in the consumer tab bar.

The schema includes User, Moderator, and Admin roles, but current admin routes require **Admin**. Do not assume a Moderator can use the console without an authorization change.

Design:

- Overview with available analytics only: signups, active users, likes, matches, messages, reports, call attempts; 24h, 7d, and 30d windows. No invented revenue, retention, cohort, or date-conversion metrics.
- Moderation case queue, filtered by status and priority, with paginated results.
- Case detail: subject, source report ID, type, assignment, summary, structured findings, action and notes, timestamps. Only show evidence supplied by the API; identify any missing evidence fetch as a dependency.
- Case assignment and action confirmation with notes.
- User lookup by known ID and user detail, profile, photos, account flags, and internal trust score/factors. There is no broad user-search/list endpoint.
- Actions supported by the appropriate endpoint: note-only, warn, remove photo, hide profile, freeze discovery/chat/calls, shadow ban, suspend, ban, restore. These options differ between case actions and direct user actions.
- Feature flags: key, description, enabled, global/percentage/allowlist scope, percentage, variant, configuration, allowlisted user IDs.
- Audit log filtered by actor, target user, entity type, with action, entity, metadata, and timestamp.

Do not imply the current repository already contains an admin frontend. This is a new design for existing admin API capabilities.

## 13. Interaction quality and accessibility

Use a primary reference frame of 390 × 844. Validate important layouts at 320 × 568 and 430 × 932; provide an Android adaptation around 360 × 800 and sensible tablet-width constraints. Use a desktop reference frame around 1440 pixels wide for admin. Respect native safe areas, keyboards, text resizing, and platform conventions.

Set explicit design acceptance targets: ordinary text contrast at least 4.5:1; large text and essential UI boundaries at least 3:1 where appropriate; interactive targets at least 44 × 44 logical pixels, with Android adaptation to 48dp. Validate the chosen tokens instead of assuming a muted palette is accessible.

For every major asynchronous screen include loading/skeleton, empty, error/retry, offline, and success where relevant. Add focus, pressed, selected, disabled, validation, long text, and pending-save variants to components. Failed saves must retain user input and restore truthful toggle states. Never leave a control looking successful before the operation succeeds.

Label icons and fields clearly. Do not use color alone for status. Avoid inaccessible low-contrast photo overlays. Use subtle motion, reduced-motion alternatives, and no essential information conveyed only by animation. Keep sticky actions above navigation and the keyboard without covering content. Forms must work on small screens with long names and wrapped labels.

Use realistic sample copy and clearly fictional people/places. Do not invent product metrics, ratings, trust claims, guaranteed safety, scientific compatibility, or unsupported encryption claims.

## 14. Figma structure and completion criteria

Organize the design into these pages or equivalent clearly named sections:

1. Brief, product principles, sitemap, and capability legend.
2. Visual directions and chosen brand foundations.
3. Tokens, typography, light/dark themes, and reusable components.
4. Authentication and onboarding.
5. Discovery and public profiles.
6. Connections and matching.
7. Conversations and media.
8. Voice/video calls.
9. Date planning and private follow-up.
10. Profile, settings, notifications, and safety.
11. System states, permissions, and accessibility examples.
12. Admin console.
13. Prototype entry points and implementation annotations.
14. Proposed additions and unresolved dependencies.

Use real editable text, Auto Layout, sensible constraints, semantic variables, component properties, and variants. Do not flatten whole screens into images. Name reusable objects clearly: buttons, inputs, chips, navigation, profile preview, prompt block, compatibility reasons, incoming-interest item, match item, message bubble, media item, date invitation, plan summary, status label, modal, bottom sheet, toast, skeleton, and empty state. Use instances instead of screen-specific copies.

Build connected prototype journeys for:

1. New user → minimum required setup → photo-review state → completed profile → Discover.
2. Discover → complete profile → private introduction → interest sent → reciprocal match → first conversation.
3. Incoming interest → profile → mutual match → match permissions.
4. Chat → media upload/pending/failure → reply/edit state → voice/video call → return to chat.
5. Match/chat → date ideas/manual plan → invitation → counterproposal → mutual acceptance → venue reveal.
6. Upcoming date → private check-in → manual share/native-help action → completion → private meet-again → mutual result.
7. Profile editing → privacy change → pause/resume → device-session revocation.
8. Report → saved report → report history; block → closed relationship; unblock without restoring it.
9. Admin case queue → case detail → action → audit entry.

Represent opposite-participant and asynchronous states as labeled prototype branches; do not pretend they are instantaneous actions by the same user. Produce a screen/state coverage checklist mapping every capability in this brief to a frame or an explicitly documented dependency.

Annotate components and screens with one of these implementation labels, outside the consumer UI:

- **Existing backend + existing client flow.**
- **Existing backend, new/redesigned client work.**
- **Partial backend/integration — dependency to resolve.**
- **Proposed capability — new backend needed.**

Current source code takes precedence over older README/API-contract text. If actual source is attached, treat it as product evidence, not visual direction, and do not read credentials or production/customer data. Source presence is not proof of a tested production service.

Finish with a short design rationale, clickable prototype entry points if available, full screen/state coverage, responsive/theme coverage, and implementation dependencies. Work through the whole product in coherent batches without dropping the less glamorous settings, safety, empty, and recovery states. The result should look and behave like a complete new Yariva product.
