# Aroha — Tinder-style + intent/interest twist · Implementation summary

**Date:** 4 May 2026
**Scope:** End-to-end audit + implementation for fast swipe Discovery, intent-first matching, the new Likes tab, and Discover filter sheet. Backend (NestJS) + frontend (Expo / RN).

---

## 1. Audit summary

| Concern | State found | What we did |
|---|---|---|
| Matching algorithm intent-weighted? | ✅ already weighted: intent (30) → interest (20) → lifestyle (15) → schedule (10) → distance (10) → freshness (10) → trust (5). | Nothing — algorithm is already correct. |
| Discovery feed accepts ad-hoc filters? | ❌ feed reads from stored `discoveryPreference`, not query params. | Re-used `PUT /profiles/me/discovery-preference` instead — filter sheet writes there, then refetches. Cleaner, no breaking changes. |
| `GET /likes/received` endpoint? | ❌ missing. | ✅ Built (service + repo query + DTO + controller + module wiring). |
| Tabs: Discover · Likes · Chat · Notifications · Profile? | ❌ tabs were Discover · Matches · Chat · Activity · Profile. Both Matches and Chat surfaced same screen. | ✅ Renamed Matches → Likes, wired to new `LikesScreen`. Chat remains the matches list (matches Figma `chat.jsx`). |
| Discover filter button wired? | ❌ icon present but inert. | ✅ Wired to bottom-sheet modal that updates `discoveryPreference` and refreshes the feed. |
| DiscoverCard surfaces intent + shared interests? | ⚠️ showed both, but ranked headline above intent. No "shared" highlight. | ✅ Reordered: name → intents → headline → interest chips with shared-interest highlighting. |
| Profile setup screens match Figma? | ⚠️ 8/9 step screens matched copy exactly; BasicInfo subtitle had drifted. | ✅ Subtitle restored. All 10 screens (BasicInfo, Bio, Intent, Interests, Lifestyle, Schedule, Discovery, Communication, Photos, Review) verified. |

---

## 2. Missing features list (now covered)

- `GET /likes/received` endpoint — new.
- Likes tab + LikesScreen — new feature.
- Discover filter bottom sheet — new (intent multi-select, age range, distance).
- Shared-interest highlighting on Discover card — new.
- BasicInfo subtitle copy fix — drift restored.
- 5-tab nav refactor (Likes replacing Matches) — done.

Out of scope (explicitly deferred to later):
- Interest filter as a discovery query parameter (currently the user's own interests drive the score; an explicit "filter by interest X" still needs schema + scoring tweaks). P2.
- Daily new-people cap (anti-addiction). P1 in earlier audit; not implemented this round.
- Conversation prompt-of-the-day. P2.
- Photo verification badge. P2.

---

## 3. Backend changes

**Files added/edited (5)**

```
src/modules/likes/dto/likes.dto.ts                      [extended]
  + ReceivedLikePreviewDto
  + ReceivedLikesResponseDto

src/modules/likes/infrastructure/likes.infrastructure.ts [extended]
  + LikeRepository.findReceivedLikes(...)               // indexed query, filters retracted/blocked

src/modules/likes/application/likes.services.ts          [extended]
  + GetLikesReceivedService                              // includes cursor + photo URL build
  + private cursor helpers (buildCursor / parseCursor)

src/modules/likes/controllers/likes.controller.ts        [extended]
  + GET /likes/received  (cursor-paginated)

src/modules/likes/likes.module.ts                        [extended]
  + import ObjectStorageModule
  + provide GetLikesReceivedService
```

**Algorithm:** unchanged — already intent + interest weighted as required. Documented in §6 below.

---

## 4. Frontend changes

**Files added (3)**

```
src/features/likes/LikesScreen.tsx                  // new — Likes tab screen
src/features/discovery/DiscoveryFilterSheet.tsx     // new — bottom-sheet filter modal
app/(app)/(tabs)/likes.tsx                          // new route (replaces matches.tsx)
```

**Files edited (8)**

```
app/(app)/(tabs)/_layout.tsx                        // 5-tab order, Likes/Chat/Notifications labels
app/(app)/(tabs)/matches.tsx                        // deleted (renamed → likes.tsx)
src/api/endpoints/likes.ts                          // + likesApi.received(...)
src/types/discovery.ts                              // + ReceivedLikePreviewDto, ReceivedLikesResponseDto, IntentValue
src/features/discovery/DiscoverScreen.tsx           // wired filter sheet, viewer interests, reload on save
src/components/discovery/DiscoverCard.tsx           // hierarchy reorder + sharedChip styling
src/features/profileSetup/BasicInfoScreen.tsx       // subtitle restored to Figma copy
src/features/matches/MatchCreatedScreen.tsx         // /(tabs)/matches → /(tabs)/chat
```

---

## 5. Updated navigation structure

```
(tabs)
├── discover         Discover         compass icon
├── likes            Likes            spark icon       ← NEW (was 'matches')
├── chat             Chat             chat icon        ← MatchesListScreen (new matches + conversations)
├── notifications    Notifications    bell icon
└── profile          Profile          user icon
```

User flow:

```
Discover  →  swipe right  →  Like recorded
                                ↓
                  Other user opens Likes tab
                                ↓
                  Sees you, taps profile, swipes right
                                ↓
                  Match created (server emits MATCH event)
                                ↓
                  Both users see new entry in Chat tab
```

---

## 6. APIs added / updated

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/likes/received` | **NEW** | Cursor-paginated. Returns slim profile preview + intents + primary photo + likedAt. Filters out retracted, blocked, hidden, incomplete. |
| `POST` | `/likes` | unchanged | Already returns `{ outcome, like, match, conversation }`. |
| `DELETE` | `/likes/{id}` | unchanged | |
| `POST` | `/passes` | unchanged | |
| `GET` | `/discovery/feed` | unchanged | Reads stored `discoveryPreference` for filtering — no new query params needed. |
| `PUT` | `/profiles/me/discovery-preference` | unchanged | Filter sheet writes here. Server invalidates discovery snapshot on save (existing behavior). |
| `GET` | `/matches` | unchanged | |
| `GET` | `/conversations` | unchanged | |

---

## 7. Matching logic explanation

The backend already does intent + interest weighted ranking inside `DiscoveryRankingService.scoreCandidate`:

```
intentScore     = 30 × overlapRatio(viewerSelectedIntents, candidateIntents)
interestScore   = 20 × jaccardIndex(viewerInterestIds, candidateInterestIds)
lifestyleScore  = 15 × normalizedLifestyleCompatibility(...)
scheduleScore   = 10 × normalizedScheduleOverlap(...)
distanceScore   = 10 × resolveDistanceBandScore(distanceKm, maxDistanceKm)
freshnessScore  = 10 × recentActivityScore(lastActiveAt)
trustScore      =  5 × normalizedTrustScore(trust)
                 - resolveTrustPenalty(trust)
total           = sum of the above
```

Candidates with the highest total surface first. A diversity pass then prevents intent-streaks (you don't see 5 "Friendship" candidates in a row) and city-streaks. So the priority order is exactly what the brief requested:

> intent → shared interests → distance/recency

Importantly, `selectedIntents` is sourced from the user's stored `discoveryPreference.intentFilter`. So when the new filter sheet writes filters back via `PUT /profiles/me/discovery-preference`, the very next feed reflects "I want a gym partner today" by zeroing the intentScore for non-friendship candidates.

`InvalidateDiscoverySnapshotService` is invoked by the existing preference-update flow, so cached snapshots are cleared automatically.

---

## 8. Final user flow

1. **Onboarding** — 9-step profile setup (BasicInfo → Bio → Intent → Interests → Lifestyle → Schedule → Discovery preferences → Communication → Photos), then a Review step. Intent + interests are mandatory; this is what the matching engine reads.
2. **Discover tab** — swipe deck. Each card shows name + intent badges + headline + interest chips (shared interests highlighted with a brighter chip + checkmark icon).
3. **Filter sheet** (top-right filter icon on Discover) — pick one or more intents, set age range, set distance. Save → preference is persisted, snapshot invalidated, feed refetched.
4. **Likes tab** — list of users who liked you. Tap a row → opens their profile. From there, like-back creates a match (existing server behavior, no new endpoint).
5. **Chat tab** — combined view of new matches (top, horizontal scroll) + ongoing conversations (bottom, list). Same `MatchesListScreen` as the Figma `chat.jsx > ScreenMatchesList`.
6. **Notifications tab** — activity feed (matches, messages, system events).
7. **Profile tab** — your own profile + settings entry.

---

## 9. Verification

```
backend: tsc --noEmit  →  clean
frontend: tsc --noEmit →  clean (287 files)
```

Smoke test path you can run on a fresh dev account:

1. Sign up, walk through 9-step onboarding, ensure photos are approved by moderation.
2. Open Discover, tap filter, set intent = Friendship only, distance = 25 km, age 22–32. Save. Feed refreshes.
3. Like a few profiles → some create matches, others stay pending.
4. From a second account, like the first account back → match created.
5. First account opens Likes tab → sees the second account in the list. Tap → opens their profile.
6. Open Chat tab → new match appears in horizontal NEW row + conversation suggested openers visible if you tap into chat.

---

## 10. Out-of-scope items (recommend P2 follow-ups)

| # | Feature | Why P2 | Backend touch | Frontend touch |
|---|---|---|---|---|
| 1 | Daily new-people cap with calm exhaustion state | Anti-addiction enforcement of "slow by design" promise | Yes — counter + reset job | Yes — empty state copy |
| 2 | Interest filter param on `/discovery/feed` | Currently interests drive scoring but can't gate the feed | Yes — query param + scoring zero-out | Filter sheet would expose it |
| 3 | Photo verification badge | Trust at scale | Yes — selfie-pose service | Profile UI |
| 4 | Voice intro snippet | Profile depth | Yes — new media type | Profile recorder + player |
| 5 | Conversation prompt-of-the-day | Sustained chat quality | Yes — content store + delivery | Chat surface |
| 6 | Replace star (super-like) with "Save for later" bookmark | Removes Tinder DNA / paywall mechanic | New endpoint | DiscoverScreen action row |

These are detailed in the earlier `aroha-product-audit.md` document.
