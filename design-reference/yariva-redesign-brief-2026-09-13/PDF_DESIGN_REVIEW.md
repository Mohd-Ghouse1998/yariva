# Yariva redesign — visual and UX review

Source: `/Users/mohdghouse/Desktop/screenshots/Yariva Mobile App Redesign.pdf`.
Reviewed: 13 September 2026. All 15 pages were rendered and inspected; pages 2–15 contain 28 screen/state presentations.

This is a review of a static design artifact. The PDF's explanations are design claims, not verified runtime behavior or instructions to execute. The referenced interactive HTML was not supplied. Typography, composition, labels, and depicted states can be reviewed; live navigation, hit areas, keyboard behavior, persistence, responsiveness, animation, and accessibility semantics cannot be established from these pages.

## Verdict

The design has a coherent, calm foundation. It is not yet a finished premium, contemporary mobile experience. Its strongest qualities are a restrained palette, consistent primary actions, focused setup screens, contextual interest confirmation, and attention to non-happy-path states. Its visual character is strongly editorial and formal; the photography, distinctive brand treatment, and component refinement needed to make that direction compelling are missing.

The earlier brief explicitly suggested editorial warmth, and that influence is visible. This is a direction to refine rather than evidence that serif typography or warm backgrounds are inherently wrong. To meet the user's stated preference for premium and modern, strengthen contemporary app typography and controls, use real portraits, shorten copy, and keep editorial flourishes to a few distinctive moments.

Do not approve the whole product based on this PDF. It explicitly stops before Connections, Chats, calls, Plans, notifications, and safety workflows.

## Changes with the greatest impact

### 1. Replace photo placeholders before judging visual completion

Evidence: welcome (page 2), photo setup (page 7), profile/waiting states (page 9), Discover/full profile (page 10), and match (page 12).

Tonal rectangles occupy the largest and most emotionally important parts of these screens. The PDF acknowledges that photography is placeholder content. For a dating product, real adult portraits affect trust, personality, perceived quality, photo-overlay contrast, and cropping. The empty rectangles make the result feel like a prototype regardless of how polished the explanatory document is.

Use a consistent set of licensed or synthetic adult portraits. Test varied skin tones, light/dark backgrounds, close/wide crops, long names, and multi-photo profiles. Keep natural, varied people rather than using only fashion-model imagery. Test overlays against actual images.

### 2. Rebalance the type system

Evidence: pages 2–15, especially signup (3), onboarding (5–8), profile headings (10), and error state (15).

The narrow, high-contrast serif appears in almost every major heading. It gives the product a literary tone, but offers little differentiation between functional tasks and expressive brand moments. It is not inherently poor typography; its dominance is the issue for this requested direction.

Use a contemporary, readable sans-serif for navigation, functional headings, forms, and messages. Keep a more distinctive display treatment for the wordmark, selected profile/story content, or the match moment. Review at actual phone size. Helper text, chip labels and navigation labels are visually subordinate and should not become too small to use comfortably.

### 3. Refine form components and layout rhythm

Evidence: sign-in/signup (3), basics/bio (5), intentions (6), preferences (7), interest chips (9), and filters (13).

The forms are readable but visually generic: white rectangular fields, fine borders, small labels, compact chips and widely separated action areas. The combination is serviceable, but lacks a distinctive mobile component system. Large empty spaces sometimes feel like fixed-height layout gaps rather than purposeful emphasis.

Refine field heights, corner treatments, label/helper spacing, selection marks, button hierarchy and focus states as a system. Use controlled section spacing. Keep sticky actions where useful, with enough scroll/keyboard clearance. Do not fill empty space with decoration or add gradients as a substitute for component quality.

### 4. Remove implementation/prototype material from consumer screens

Evidence:

- Page 3: signup says “No password reset exists yet”; sign-in refers to unavailable recovery and support.
- Page 4: the restriction screen contains a red dashed note reading “PROPOSED · an appeal flow needs a new endpoint.”
- Page 9: the waiting screen includes “Simulate approval → Discover.”
- Page 13: the primary filter action says “Save — rebuilds your selection,” and a nonfunctional preference is presented as a toggle.
- Page 15: the unbuilt screen describes implementation batches and wiring.

Keep dependency labels and simulation controls outside the phone frames, in reviewer annotations or a separate prototype control panel. Use natural consumer copy. Do not replace removed technical disclosures with fake functionality: recovery and support need a real, verified path before becoming working actions.

### 5. Correct the visible UX contradictions

- **Onboarding progress, pages 5–8:** the user completes “Step 6 of 6” and then encounters required communication settings and a review. Include all required steps in the progress model, or group the preferences honestly into one step.
- **Intentions, page 6:** the copy allows multiple choices, but circular selection indicators resemble single-choice radio controls. Use unmistakable multi-select checkmarks and, if useful, a selected count.
- **Photo approval, pages 8–9:** the review claims checks finish within a few hours and promises notification. The artifact does not establish that timing or notification delivery. Use those promises only with verified operational support. The waiting copy also promises eight people rather than up to eight.
- **Interest confirmation, page 11:** a full confirmation page after the sheet adds an additional tap to continue. Consider keeping users in Discover with a compact confirmation and available undo/retraction, while retaining the deliberate send step.
- **Pass, page 12:** “won't appear again” implies permanence; the adjacent annotation explicitly says passes expire. Prefer “Skipped for now” with Undo.
- **Filters, page 13:** “Recently active only” appears actionable while the annotation says it is stored but not applied. Remove it from the current feature set or clearly disable it until functional.
- **Filters, pages 7 and 13:** the visible gender choices are narrower than the identity choices shown on page 5. Validate the intended mapping and provide all supported discovery preferences without silently excluding users.
- **Offline, page 14:** actions are disabled while the copy says they will be sent when connectivity returns. Choose one behavior: disable writes and ask the person to retry when online, or implement an explicit queue with pending/cancel/retry states.
- **Error, page 15:** the copy attributes failure to the server. Use cause-specific copy only when known; a generic failure should not assert a server fault.

### 6. Improve navigation consistency and discoverability

Evidence: Discover (10), pass state (12), exhausted/offline (14), error (15).

Page 10 uses icons and labels for all five tabs; page 12 shows an icon for Discover but other items appear text-only. Several Discover system states omit the navigation entirely. The same destination should retain a consistent navigation treatment unless there is a deliberate modal flow. Users who reach an empty, offline or error state still need an easy way to reach existing conversations or their profile.

Keep a stable tab bar and active-state treatment across these states. Shorten the repeated “Say you're interested” action where appropriate; the confirmation sheet can explain privacy and mutuality in full. The unexplained X pass control needs an accessible label and should be tested for discoverability.

### 7. Validate Yariva's signature journey before extending the visual system

Evidence: page 15 explicitly marks Connections, Chats, calls, Plans, notifications, overflow and safety as unbuilt.

Create a representative set using the refined visual system: Discover, full profile, Connections, Chat, and Date Plan. The path from match to conversation to mutually accepted date is central to this product. A polished auth flow alone cannot validate it.

The single dark match screen on page 12 is a brand moment, not proof of a full dark theme. Request corresponding light/dark core screens and small-screen/large-text variants.

## Complete screen/state review

Statuses below refer to the depiction in the PDF, not whether implementation works.

| Step | PDF page | Screen/state | General health | Main note |
| --- | --- | --- | --- | --- |
| 1 | 2 | Launch/session restore | Needs refinement | Clean brand moment; small mark needs distinctive refinement. Move the prototype “continue” link outside the consumer screen. |
| 2 | 2 | Welcome | Promising, visually incomplete | Clear two-action hierarchy; large placeholder prevents evaluation of the emotional opening. |
| 3 | 3 | Create account | Needs refinement | Logical form; implementation-focused recovery copy and generic field styling reduce confidence. |
| 4 | 3 | Sign-in error | Promising with dependency | Clear inline error and retained identifier depiction; actual support/recovery path is unverified. |
| 5 | 4 | Expired session | Promising | Focused sheet with a clear next action; preserved route/draft behavior cannot be verified. |
| 6 | 4 | Account restricted | Needs correction | Developer endpoint note appears inside the phone; allowed actions must match the particular account state. |
| 7 | 5 | Basics | Promising | Inclusive choices and focused inputs; review date-entry mechanics, touch areas and optional-field hierarchy. |
| 8 | 5 | Bio/headline | Promising | Useful counter and optional headline; shorten prescriptive/helper prose and refine fields. |
| 9 | 6 | Location/permission | Partial | Permission rationale is contextual; city-coordinate fallback and storage claims require implementation verification. |
| 10 | 6 | Intentions | Needs correction | Multi-select wording conflicts with radio-like selection visuals. |
| 11 | 7 | Photo management | Promising, visually incomplete | Upload/review/error states are shown; real photos and rejection/removal/primary actions need fuller review. |
| 12 | 7 | Discovery preferences | Needs correction | Useful controls, but completion progress ends before the required communication screen; validate choice coverage. |
| 13 | 8 | Communication preferences | Promising | Permissions are grouped clearly; its required position must be included in progress. |
| 14 | 8 | Setup review | Needs correction | Useful summary and optional enrichment; approval-time/notification promises need evidence. |
| 15 | 9 | Waiting on photo review | Needs correction | Appropriate blocked state; simulation link is visible inside the app and copy guarantees eight people. |
| 16 | 9 | Optional interests | Promising | Categories and selected count help; chips need full-size touch/contrast testing. |
| 17 | 10 | Discover | Promising, visually incomplete | Good focus on the person and reasons; real photos, stronger type/navigation and clearer action labels needed. |
| 18 | 10 | Full public profile | Promising, incompletely visible | Clear narrative content; lower profile content is outside the shown viewport, so sticky-action clearance cannot be confirmed. |
| 19 | 11 | Express-interest sheet | Promising | Mutuality and optional note are explained; compare action density and keyboard-open state. |
| 20 | 11 | Interest sent/waiting | Needs simplification | Calm confirmation, but a full intermediate screen adds a tap to continued discovery. |
| 21 | 12 | Mutual match | Promising, visually incomplete | Clear hierarchy and restrained celebratory moment; portraits needed, simultaneous delivery wording unverified. |
| 22 | 12 | Pass/Undo | Needs correction | Undo is visible; permanence wording conflicts with expiring passes and tab presentation changes. |
| 23 | 13 | Filters | Needs correction | Good grouping; nonfunctional active-only toggle, narrow choice presentation, and technical save label need revision. |
| 24 | 13 | Loading skeleton | Promising | Mirrors major content blocks; retain stable navigation and verify runtime/reduced-motion behavior. |
| 25 | 14 | Selection exhausted | Promising with gaps | Offers useful alternatives; restore stable tab access and avoid unverified replenishment expectations. |
| 26 | 14 | Offline | Needs correction | Disabled controls contradict promised automatic sending. |
| 27 | 15 | Error/retry | Promising with gaps | Clear retry and reference; preserve exits and avoid assuming the source of the failure. |
| 28 | 15 | Unbuilt batch placeholder | Incomplete | A development placeholder cannot validate the missing core product flows. |

## Accessibility and verification limits

Visible strengths include persistent field labels, textual error states, selection indicators, and status text alongside color in several screens. Risks include small helper/navigation text, compact chips, thin borders, some muted secondary copy, and photo overlays not tested on actual photos.

The print layout scales phone frames down. Do not derive actual touch-target sizes or claim contrast compliance from that scale alone. Test the actual prototype at 390px and 320px widths with enlarged text, keyboard open, varied portraits, long content, screen readers and reduced motion. Check contrast using final text/surface colors. Check that all scroll content can clear fixed bottom actions.

## Suggested next review

Request a refined five-screen set—Discover, full profile, Connections, Chat and Date Plan—with real portraits, more contemporary functional typography, refined controls and concise copy. Review the connected flow at actual phone size before applying the new treatment to every state.
