# Yariva: consent-led social expression and discovery

Research and static code audit, 19 October 2026. This is a proposed next phase, not an instruction to change application code or a claim that a feature has passed device QA. Existing implementation status remains in `YARIVA_IMPLEMENTATION_PROGRESS.md`.

## Product decision

Pursue a **small, privacy-first extension** of Yariva's existing approved-follow and private-Story systems. The valuable journey is: choose a safe audience, share something genuine, receive a respectful response, then optionally form a friendship, date or plan. A general Instagram-like feed, algorithmic engagement loop or open LGBTQ+ directory is not the starting point. Those would increase moderation cost and identity-disclosure risk before there is evidence of demand.

This is a hypothesis to test with Hyderabad adults across LGBTQ+ and heterosexual groups, including people who are not publicly out. Private sharing is not unique by itself. Yariva can distinguish itself only if the combined experience feels safer and produces better real connections than alternatives.

## What Instagram publicly documents

| System | Verified public behavior | What remains private/unknown |
| --- | --- | --- |
| Following and feed | Instagram offers a chronological Following feed and a Favorites feed; ranking also uses predictions and user feedback. | Exact current weights, thresholds and all feature engineering. |
| Follow requests and privacy | Private accounts require approval before non-followers can view shared content. Account/privacy behavior can vary by age and surface. | Exact account-suggestion ranking and every visibility exception. |
| Stories and selected audiences | Close Friends lets people select a narrower Story audience. Instagram has also introduced casual sharing to mutual followers or Close Friends. | Exact Story ranking and notification rules for every account state. |
| Explore/suggestions | Meta describes multi-stage candidate retrieval and ranking for Explore; recommendations can include accounts/content beyond the follow graph. Users can signal Interested/Not interested and reset recommendations. | A reproducible Instagram recommendation algorithm. Do not ask an engineer to clone it. |
| Mutuals and connected experiences | Mutual relationships and cross-account personalization can support discovery. | Whether a particular suggestion was caused by a mutual, contact or another private signal. |
| Notifications/retention | Stories, messages, replies and new content create reasons to return; Meta says its ranking predicts value using multiple signals. | Any claim that a specific notification or ranking signal causes healthy retention. That requires our own experiment. |

Sources: [Following/Favorites](https://about.fb.com/news/2022/03/two-new-ways-to-control-your-instagram-feed/), [Meta ranking overview](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/), [Explore architecture](https://ai.meta.com/blog/powered-by-ai-instagrams-explore-recommender-system/), [recommendation controls](https://about.fb.com/news/2024/11/introducing-recommendations-reset-instagram/amp/), [Close Friends](https://about.fb.com/news/2019/10/privacy-matters-threads/amp/), [private account safeguards](https://about.fb.com/news/2021/07/instagram-safe-and-private-for-young-people/), [connected-account suggestions](https://about.fb.com/news/2020/09/privacy-matters-accounts-center/), [2025 friend/location controls](https://about.fb.com/news/2025/08/new-instagram-features-help-you-connect/), [2026 Instants](https://about.fb.com/news/2026/05/instants-share-in-the-moment/amp/). These sources describe public product behavior, not Instagram's private business logic.

The useful retention lesson is a reliable social loop: relevant people, a low-pressure reason to speak, a reply worth returning for, and user control over the relationship. Do not copy infinite scroll, streak pressure, indiscriminate push notifications or dwell-time maximization. Test whether Yariva improves **reciprocal conversations, comfort and real plans**, not simply daily opens.

## Competitor reality

| Platform | Documented strength | Consequence for Yariva |
| --- | --- | --- |
| Instagram | Huge existing social graph, Close Friends, discovery, Stories, recommendations and flexible sharing. | Yariva cannot win by cloning follows and Stories. Its advantage must be consent and relationship outcomes. |
| Tinder | Dating scale and [Block Contacts](https://www.help.tinder.com/hc/en-us/articles/360039684672-Block-Contacts); Tinder warns matching contact details are required, so it is not a guarantee. | Contact shielding matters, but must be described honestly as best effort. |
| Bumble For Friends | [Plans](https://bumble.com/the-buzz/bumble-for-friends-plans) already supports local group friendship meetups. | Group plans are not unique; ease, safety and local quality matter. |
| Hinge | [LGBTQ+ prompts and gender options](https://hinge.co/newsroom/prompts-for-lgbtq-daters) help people express identity and start conversations. | Inclusive profile fields alone are not differentiation. |
| HER | [Communities, dating and events](https://weareher.com/download/) serve sapphic, trans and nonbinary users. | Queer community plus dating already exists; do not imply Yariva invented it. |
| Lex | [Local queer groups, events and friendship](https://www.lextheapp.com/) emphasize community. | Pseudonymous or low-pressure expression needs careful moderation and clear purpose. |
| Feeld | [Incognito](https://support.feeld.co/hc/en-gb/articles/9406755132316-Incognito-explained) and [private-photo controls](https://support.feeld.co/hc/en-gb/articles/9406792622748-Private-photos-explained) emphasize discretion. | Privacy controls must be enforced across all surfaces, not just profile UI. |

The competitive comparison is directional, based on public documentation, not a live usability study or measured Hyderabad market share. In particular, a small local user pool may make a privacy-only network feel empty. Recruit enough safe, relevant people and measure useful connections before broadening the feed.

## Current Yariva code audit

Static inspection of the current checkout; no production data, live phone, penetration test or real multi-user session was inspected for this report. “Implemented in code” does not mean rollout-ready.

| Capability | Evidence and status | Gap or risk |
| --- | --- | --- |
| Inclusive identity and intent | `aroha_backend/prisma/schema.prisma` has `ProfileGender`, pronouns and separate private community preferences (`identifyAs`, `connectWith`, `optedInCommunities`). **Implemented data model.** | Test all choices in onboarding/profile/Discover on device. `connectWith` is a preference, not a safe inference of someone's identity or orientation. |
| Follow, unfollow, requests and lists | `PrivateFollow`, private-Stories controller/service and `frontend-mobile/src/features/privateStories/PrivateFollowsScreen.tsx` provide pending/approved relationships, owner lists and actions. **Implemented in code.** | Verify races, cross-account permissions, notification contents and device states; do not treat a pending follow as Story access. |
| Private Stories | `PrivateStory`/`PrivateStoryGrant`, server-side checks in `private-stories.service.ts`, mobile Story rail/composer. Audience is `ALL_APPROVED` or selected approved recipients; current grants are snapshotted and rechecked for expiry, moderation, blocks and relationship. **Implemented in code; rollout incomplete per tracker Feature I.** | Finish existing P8 acceptance/QA before adding another sharing model. Signed media URLs may remain usable until their short expiry after access is revoked; audit cache and notification leaks. |
| Discover and preference filtering | `discovery.services.ts` builds 24-hour candidate snapshots using eligibility; `discovery.infrastructure.ts` filters candidates by active/hidden/paused state on page reads. **Implemented in code.** | Page reads from a stored snapshot call `findCandidatesByIds(pageIds)` without the viewer, so they do not re-evaluate a new block/match/pass/like relation. This is a code-path risk to prove with a focused regression test and fix before social recommendations. |
| Hide from contacts | `UserProfile.hideFromContacts` exists in Prisma/profile mapping. `privacySettings.test.ts` explicitly expects the mobile update mapper to omit it. **Stored field, not a verified working protection.** | No reliable contact-shield flow or enforcement was found in inspected paths. Do not show a switch that promises protection until its scope and limitations are implemented. |
| Mutuals, suggested people, posts | No consent-aware mutual-connection/recommendation path was found in inspected discovery/social modules; no separate general post feed was found. **Not verified as implemented.** | Do not add a public feed by default. Mutual counts/names can expose closeted identity or relationships. |
| Block, report, account hiding | Schema/services include block/report and hidden/incognito/paused states. **Existing baseline in code.** | Audit every surface: Discover, Scenes, Story rail/detail/media, follow lists, profile, search, chat, notifications, caches and previously issued links. |

Key code paths: `aroha_backend/src/modules/private-stories/application/private-stories.service.ts`, `aroha_backend/src/modules/discovery/application/discovery.services.ts`, `aroha_backend/src/modules/discovery/infrastructure/discovery.infrastructure.ts`, `aroha_backend/prisma/schema.prisma`, `frontend-mobile/src/features/privateStories/`, `frontend-mobile/src/features/settings/privacySettings.ts`. Confirm branch and working-tree state before acting on these findings.

## Privacy and safety rules for the proposed phase

1. Sharing starts with an explicit per-Story audience choice: selected approved people or all approved connections. Show a readable audience preview/count before publishing. A request, dating preference, community label or shared interest never grants access automatically.
2. Keep identity/community fields private by default. Community-filtered sharing may use only a recipient's **affirmative opt-in** and existing approval, without displaying their membership to others. Do not use `connectWith` as a proxy for identity.
3. Default follower/following lists, mutual names/counts, relationship activity and suggested-profile explanations to private or generic states. Reveal a mutual person only after consent from everyone whose relationship is exposed. Do not derive suggestions from uploaded contacts, identity or sexual orientation without separate explicit consent.
4. Treat blocking, unfollowing, deletion, expiry and moderation as revocation events. Recheck authorization on every request and on cached candidate pages; use short-lived media access and avoid sensitive data in pushes, logs, analytics or previews. Client hiding alone is insufficient. Screenshots and previously seen content cannot be reliably recalled.
5. No exact live location on a Story, no automatic cross-posting, no forced public profile, no blanket “safe from everyone you know” claim. Provide generic notification text, quiet defaults, report/block controls, abuse triage and clear account deletion/data-retention behavior. Any contact shielding must state best-effort limitations.

## Prioritized roadmap

| Priority | Work and user value | Complexity / privacy risk | Evidence gate and likely impact |
| --- | --- | --- | --- |
| **Must-have before wider social rollout** | Finish and device-verify existing private Stories/approved follows; test audience changes, revocation, cross-account access, media moderation, blocks and notifications. Fix the cached-Discover safety recheck. Make audience choice understandable. | Medium–high / high if wrong. Reuse current models, services, screens and flags. | Two-account and blocked-user tests plus device QA. Primarily trust and safe retention, not a guaranteed growth lift. |
| **Must-have research** | Interview a diverse Hyderabad adult pilot, including closeted users; test whether Stories help people start conversations and whether audience wording feels safe. | Low build cost / high research sensitivity. Recruit consentfully. | Qualitative comfort, disclosure fears, reasons not to post; decide whether to proceed before adding a feed. |
| **High-impact if validated** | Add a small opt-in “express and connect” flow using existing private Stories: respectful reply or reaction leading to chat only when existing permissions allow; optional named circles only if current audience selection is too cumbersome. | Medium / medium–high; avoid duplicate post/Story models. | A/B or staged pilot: meaningful reciprocal conversations per active participant, accepted follows, self-reported safety; guardrail report/block rate. |
| **High-impact but privacy-sensitive** | Best-effort contact shielding and opt-in suggestions from non-sensitive shared interests and relationship intent. Offer “why shown,” hide/dismiss and opt-out; never show mutual identities by default. | High / high. Requires privacy threat model, contact-data handling and cache tests. | Only launch when the false-negative limitations are explicit and cross-surface behavior is verified. Measure accepted, safe connections, not raw impressions. |
| **Future only if demand and moderation capacity justify it** | Pseudonyms or anonymous expression, broader groups/community posts, ML ranking, complex graph recommendations. | High–very high / high. Abuse, impersonation, accidental disclosure and moderation scale. | Separate research and architecture decision. Do not put these into the active feature tracker as implemented. |

Healthy outcome measures: first safe share among consenting users, share-to-reciprocal-conversation rate, repeat reciprocal connections, voluntarily agreed plans, self-reported comfort/trust, report/block rate, unwanted-exposure incidents and time to resolve them. Instrument only with consent/minimization; avoid raw sensitive identities in analytics. Compare outcomes by cohorts without publicly exposing anyone's group membership. A 7-day return rate is useful context, not the objective by itself.

## Ready-to-paste AI prompt: research and implementation design only

```text
Act as a senior privacy engineer, inclusive product designer and Yariva full-stack architect. Work in the existing /Users/mohdghouse/Documents/Aroha repository. Do not edit application code, migrations, feature flags or tracker checkboxes in this task. Do not claim that a UI element proves a backend feature works.

Read the current master prompt, YARIVA_IMPLEMENTATION_PROGRESS.md, the existing private-Stories implementation prompt, and YARIVA_CONSENT_LED_SOCIAL_EXPRESSION_RESEARCH_2026-10-19.md. Inspect only relevant current code and tests in aroha_backend and frontend-mobile; verify each report claim against this checkout and flag stale findings. Review public primary documentation for Instagram's follows, requests, Close Friends/Stories, Explore/recommendation controls and notifications, plus Tinder, Bumble For Friends, Hinge, HER, Lex and Feeld. Clearly separate documented behavior, inference and unknown proprietary algorithms. Do not copy an Instagram algorithm.

Deliver: (1) an evidence-linked feature/status matrix with implemented, partial, missing and broken labels; (2) privacy threat model for closeted/LGBTQ+ and other privacy-sensitive users covering contact discovery, mutuals, audience changes, blocks, caches, media URLs, notifications and screenshots; (3) a minimal, reusable product flow from approved-audience expression to respectful conversation and optional meetup; (4) must-have/high-impact/future roadmap with user value, complexity, privacy risk and acceptance gates; (5) small Hyderabad pilot plan with healthy-retention and safety metrics; (6) a concrete next implementation slice and tests, but no code changes.

Reuse current approved-follow, private-Story, block/report, Discover and theme/navigation systems. Never infer identity from connectWith or dating preferences. No public feed, forced contact upload, automatic cross-posting, exact-location sharing, default mutual-name display or engagement streaks. Do not promise that contact blocking or screenshots can be prevented perfectly. Finish/verify Feature I before extending it. Keep the output concise, use links to exact files and primary sources, and list uncertainties that require live device or multi-user verification.
```

When the research gate is satisfied and implementation is separately authorized, use the roadmap as a specification for the smallest validated vertical slice. That later task should update the existing tracker; this research task must not mark a feature complete.
