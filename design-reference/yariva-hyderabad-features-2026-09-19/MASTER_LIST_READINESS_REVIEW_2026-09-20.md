# Yariva master-list readiness review

**Follow-up:** the [consolidated full-stack UI/UX master prompt](/Users/mohdghouse/Documents/Aroha/design-reference/yariva-hyderabad-features-2026-09-19/YARIVA_FULL_STACK_UI_UX_MASTER_PROMPT_2026-09-20.md) now specifies the selected extensions for the user's subsequent implementation-prompt request. This review records the comparison that preceded that revision; it is not a claim that the features have been implemented.

Reviewed 20 September 2026 against the user's newly attached master list, the existing eight-feature plan and implementation prompt, and selected current repository files.

Attachment: `/Users/mohdghouse/.codex/attachments/74b45ca7-7bbc-4c92-a84b-5b8e480956bf/pasted-text.txt`.

## Decision

We have enough direction to begin the foundation and corrected core features in phases. The attached list is **not an implementation-ready replacement for the existing engineering prompt**. Its examples introduce extra features and promises that were not included before.

No additional large feature category is needed to start. The most useful refinement is shared time and budget selection within the existing Scenes/Date Plan journey. This revisits the earlier Date Ready discussion rather than inventing another independent mode.

This review records recommendations. It does not change application code, authorize real payments or silently add extensions to the existing implementation prompt. The attachment's closing suggestion to work on marketing or a logo is document content; those tasks were not requested here.

## Feature comparison

| Attached feature | Already analyzed? | Correction or additional scope |
| --- | --- | --- |
| Daily Scenes | Yes | The Scene expires after 12 hours; the profile does not reset. A shared activity creates a relevant candidate, not an instant mutual match. Preserve both people's consent. A specific activity time must not remain actionable after it passes. |
| Wingman | Yes | Preserve invitation acceptance, four individual approvals and four-person chat. The earlier prompt does not include a complete four-person Date Plan flow. Linking friends cannot promise to remove anxiety or guarantee safety. |
| Safety Midpoint Venue Matcher | Core yes; discounts no | Suggest up to three reviewed public places. Do not guarantee safety, high ratings, equal travel time or a particular real venue's suitability without evidence. A 10% coupon requires a real participating venue and offer rules. |
| Mandatory five-second Vibe Check | Media yes; forced capture-only policy differs | Previous plan allows validated uploaded/recorded media and recommends an optional pilot. Mandatory in-app capture with no gallery import is a separate policy and UX decision. Neither voice nor a short video establishes identity or proves that content is unedited. |
| Local slang engine | Yes | Offer optional tone and proper language fallbacks. Keep block/report, consent, permission and money actions explicit. Do not replace the entire UI with slang. |
| Anti-ghosting UPI deposit | Mock state machine yes; live collection no | Existing prompt is mock-only. Real deposits, venue QR operations, instant refund claims and spendable coffee credit are extra scope. Do not present simulated money as live UPI. |
| Thursday Blind Vibe, 8–10 PM | Progressive photo reveal yes; event scheduling and playlists no | Make the event opt-in for adults in an eligible cohort. Do not blur every Hyderabad profile or interfere with existing conversations. Define IST scheduling, enrollment, event end and relationship-specific reveal. Playlist integration is separate. |
| Sunday Hype Report | Streak ledger yes; weekly recap/export no | This adds weekly aggregation, card rendering, sharing and notifications. It also changes the previous qualifying-Scene reward into a login reward. Retain intentional-action rewards unless that policy is explicitly changed. Use the current theme rather than silently imposing neon. |

## Three major claims to remove

1. **Instant connection from a shared Scene.** Discovery and matching are different. The system can find a candidate with a similar plan, but both people must choose to connect. It cannot promise a match for every activity, locality or time.
2. **Guaranteed safe places or genuine identities.** Review labels should identify what was actually checked. Audio can express personality; it cannot verify the speaker's profile photograph. In-app recording narrows the capture workflow but cannot prove identity, prevent all replay or establish that a device is uncompromised.
3. **Instant money back and automatic coffee credit.** Provider operations can be pending or fail. A refund and compensation are different operations. Razorpay's current terms route refunds to the same original payment method; money going to the other person needs a separately supported mechanism. A redeemable coffee credit additionally requires a defined issuer, merchant acceptance, redemption and refund policy. [Razorpay terms](https://razorpay.com/terms/)

The current mock commitment design already includes cancellations, uncertain attendance, disputes, duplicate jobs and incomplete settlement. Do not discard those rules to reproduce the attachment's simplified story. Real-money eligibility requires separate provider and business-model review before any live activation.

## Thursday Blind Vibe: proposed extension, not yet in the coding prompt

This could be tested as a scheduled social event that concentrates willing participants in one time window. That is a product hypothesis; it has not been validated with Yariva users.

Recommended first definition:

- Users explicitly enroll in the event and can leave; ordinary discovery remains available.
- Use 8–10 PM `Asia/Kolkata` for a configured Thursday occurrence. Store the occurrence and timestamps on the server, rather than using the phone's clock to control eligibility.
- Match only mutually eligible participants who opted into a blind introduction. If too few participate, show an honest unavailable/waiting state; do not invent activity or widen boundaries silently.
- Reuse the agreed photo policy: count eligible messages from both sides, with five per participant for the ten-message threshold. A timer or a local switch cannot bypass disclosure consent.
- Ending the event closes new event introductions. It does not delete conversations or automatically reveal every still-blurred photo. Existing blind relationships retain their policy unless both agree to reveal or leave.
- Keep blocked users, exact locations, unblurred avatars and video previews from bypassing the blind experience. Retain the original-media access restrictions already planned.
- Favorite music can be a later profile enhancement. Importing or playing playlists requires a separate provider/permissions/design decision; no Spotify or Apple Music integration is assumed.

Before implementing this extension, document its additional event/enrollment model, API states, notification behavior and lifecycle tests. The existing blur component alone does not implement a timed city event.

## Sunday Hype Report: proposed extension, not yet in the coding prompt

A weekly card may be a pleasant recap and an optional way for users to introduce friends to Yariva. It is not evidence of viral growth or a reason to track users' movements.

Recommended first definition:

- Generate a private weekly report from authorized, existing activity records using explicit IST week boundaries. Decide whether Sunday evening ends the report's week or whether the card describes the previous completed week; display the period accurately.
- Use truthful measures such as Scenes published or plans accepted. Label a meeting as reported/confirmed only if the supporting event actually exists. A chat, accepted plan or QR attempt is not automatically a completed meetup.
- Do not invent “15 km traveled” from the distance between profiles, venue suggestions or map estimates. Omit travel distance from the first version; background location collection is not required for a recap.
- Preserve the existing Space Grotesk/Inter fonts and warm-neutral theme. A share card can be visually expressive without redesigning the app around the attachment's neon instruction.
- Let the user preview and choose what to share. Exclude other people's names, photos, chat excerpts, exact places/times and private relationship details by default. Sharing the user's own summary must not publish someone else's participation.
- Use a manual share/export flow. Do not post automatically or equate opening a share sheet with a completed Instagram post. A working native share flow does not establish a specific direct Instagram integration.
- Keep low-activity weeks neutral; do not invent achievements or shame someone for not dating. Keep point rewards tied to the previously proposed qualifying action, not app opens, unless a separate change is chosen.
- Provide opt-in recap notifications with deduplication and user controls. Repeated generation/retry must not grant extra points.

A current repository check still found `Push dispatch stub delivered...` in `aroha_backend/src/modules/notifications/application/notifications.services.ts`. Real external push delivery needs implementation and device verification before promising Sunday notifications.

## Venue discounts: separate commercial scope

The attachment's named café and 10% offer are hypothetical examples, not verified partner arrangements. A public listing must not imply a partnership that does not exist.

An eventual offer needs an authorized venue, exact eligible products/services, validity period, redemption limits, cancellation/refund terms and an auditable redemption flow. Advertising must be labelled separately from organic recommendations and venue-review status. There is no need to implement this before the existing venue suggestions become useful.

## One refinement worth prioritizing

Add a small **shared time and budget step** to the existing meeting flow:

> “I am free Saturday, 6–8 PM, and would like to keep coffee under ₹300 per person.”

The other person supplies their own acceptable window and spending limit. Suggestions use the overlap, or explain that the pair needs to choose another option. Preserve private origin locations and show the final agreed terms clearly.

This closes a practical gap: two people may both select coffee but be free at different times or prefer very different budgets. Current Scenes match activity and intent; a text mention of “7 PM” is not a tested structured time-overlap rule. Existing Date Plans contain time/budget fields, so reuse and extend those models where possible instead of creating a separate planning app.

This refinement is recommended for the next specification revision. It is not already fully covered by the current eight-feature prompt, and it should not be advertised as a globally unique invention.

## Implementation readiness and sequencing

**Ready to start under the existing corrected prompt:** baseline checks; Scenes; reviewed venue suggestions; the Vibe media pipeline; optional local tone; ordinary opt-in Blind Vibe; Wingman; non-cash streaks; and the mock commitment simulator. Complete each phase and verify existing flows before proceeding.

**Needs an explicit specification extension:** timed Blind Vibe events, weekly recap/export, music/playlists, commercial coupons, mandatory capture-only publishing and a complete group planning experience. These are not prerequisites to starting the core work.

**Not ready for live launch:** real deposits/payouts, universal instant-refund promises, fabricated venue partnerships/ratings, or claims that clips guarantee identity and meetups are safe.

Recheck basic operational readiness alongside features: actual push delivery, authenticated/block-aware access, profile/media moderation, location permissions, working chat/date plans, error recovery and physical-device testing. A verification status field is not a complete identity-verification workflow. This review did not run production or device acceptance tests.

No feature list proves market success. Paired dating already has a public precedent in Tinder's selected-market Double Date experience. Yariva's execution, eligible local participation and useful meetings must establish its advantage. [Tinder Double Date](https://www.help.tinder.com/hc/en-gb/articles/34712866048653-Double-Date)
