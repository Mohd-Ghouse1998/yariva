# Yariva mobile design system

## Product promise

Yariva is an India-first, dating-first product for compatible singles who want to move from an honest profile to a real public date. The core journey is:

`intentional profile → curated discovery → mutual match → conversation → safe date plan → private meet-again response`

The interface should feel warm, adult and calm. It must never resemble endless swipe entertainment, paid companionship, a matrimonial biodata form or a general events network.

## Foundations

| Token      | Value     | Use                                         |
| ---------- | --------- | ------------------------------------------- |
| Ivory      | `#FFFCFB` | Light in-app canvas                          |
| Petal pink | `#D02560` | Accessible primary action and selected state |
| Brand pink | `#F45F87` | Decorative emphasis from the reference       |
| Blush      | `#FFF0F4` | Tinted surfaces and quiet highlights         |
| Petal blush | `#F8ABA8` | Soft petal highlights                     |
| Peach      | `#FFB59C` | Decorative warmth                           |
| Coral      | `#FF6248` | Decorative accents                          |
| Trust      | `#2F6F5E` | Verification and safety states only         |
| Ink        | `#171719` | Primary text and readable icons              |
| Night      | `#171719` | Dark in-app canvas                           |
| Surface    | `#FFFFFF` | Cards and sheets                             |

Dark mode uses the matching petal `darkPalette`; feature screens must read semantic palette tokens and must not introduce a second colour system. Space Grotesk is used for product and section headings. Inter is used for body, controls and data. Shared primary buttons blend reference peach into pink, with ink labels that remain readable across both ends. Active navigation and selected chips use the quieter `blendSoftStart` → `blendSoftEnd` pair with `textBrand`; message bubbles use that same soft pair with primary ink text. Reserve solid deeper pink with its matching `textOnBrand` for high-contrast badges and accents.

## Brand identity

The public product name is **Yariva**. The canonical mark is the three textured
pink petals in the user's supplied artwork. `assets/brand/petal-artwork.png`
is their transparent cutout and the single source for the in-app mark, native
launcher icons and splash marks. `assets/yariva-wordmark.png` remains the source
for the exact Yariva lettering in auth, headers and splash; only its dot is
recolored for the shared palette.

- Use `YarivaMark` for square or icon-sized placements and `YarivaWordmark` for
  brand-name placements. Never crop the wordmark to manufacture a mark.
- The textured petals may appear at low opacity in quiet space (for example a
  chat thread) and prominently at a match celebration; never repeat them behind
  profile photos, dense lists, or body copy.
- App icons contain the mark only—no wordmark, tagline, photograph, shadow or
  manually rounded corners.
- Android adaptive foreground and monochrome exports remain transparent and
  inside the central mask-safe zone. The background is a separate Ivory layer.
- iOS and legacy Android icons are opaque. The operating system owns the mask.
- Both splash exports remain transparent and use the supplied petal artwork;
  native launch uses the same Ivory first frame in either mode.
- Existing `com.aroha.mobile`, `aroha://` and `aroha.*` storage identifiers are
  compatibility details, not public brand copy. They must not be renamed
  without an app-update and session-migration plan.

The 4px spacing scale in `src/theme/spacing.ts` is authoritative. Default screen padding is 20px, card radius is 18px, input radius is 12px, and section spacing is 24–32px. Shadows remain subtle and never replace a visible boundary.

## Components

- Use the shared `Button`, `IconButton`, `Input`, `Card`, `Chip`, `Text`, `Screen`, `EmptyState`, `Skeleton` and `BottomSheet` primitives.
- Dating context is expressed through shared `IntentBadge`, `VerificationBadge`, `CompatibilitySummary`, `ProfilePreviewCard`, `DatePlanCard`, `SafetyBadge`, `SegmentedControl` and `ResponsiveBottomAction` components.
- Do not create route-specific copies of buttons, cards, badges, segmented controls, API clients, DTOs or theme values.
- A new shared component must have at least two consumers or represent a domain object used across multiple states.

## Controls

- Minimum touch target: 44×44px.
- Standard button: 48px high. Compact visual buttons may be 40px while keeping a 44px hit target.
- Shared primary and secondary buttons use compact 14px rounded corners, not capsules; only the primary carries the peach-to-pink gradient.
- Icons: 20–24px inside a 44px target.
- Use one dominant CTA per section. Tertiary actions are text or tonal controls.
- Labels wrap or remain visible; they must not truncate into ambiguity.
- Every control exposes a role, usable label, disabled/selected state, and visible pressed/focus feedback.

## Navigation

The five primary tabs are Discover, Connections, Date Plans, Chats and Profile. Notifications live in the Connections and Chats headers. Connections owns incoming likes and match states; Chats owns direct conversations only. No screen may duplicate a primary-tab purpose.

## Responsive behaviour

The production checkpoints are 320×568, 390×844 and 430×932, plus tablet-width constrained forms. Screens use safe areas, `useWindowDimensions`, flexible rows, wrapping chips, bounded image aspect ratios and keyboard avoidance. Lists include bottom padding greater than the tab bar. Sticky actions must never cover scrollable content.

No nested vertical `ScrollView`/`FlatList` combinations, fixed hero heights that clip small devices, negative-position layout hacks, oversized circular actions, or raw feature-level hex colours.

## Interaction and state

Discovery is a limited curated list, not a swipe deck. The feed offers a compact action rail, but “Interested” always opens a confirmation before sending; the complete profile stays one tap away. “Not for me” is recoverable with Undo. A short introduction may accompany an interest and is visible only to its recipient—there are no public comments. Date plans reveal exact venue information only after mutual acceptance.

Every asynchronous surface has loading, empty and recoverable error states. Important state is expressed with text or iconography in addition to colour. Reduced-motion users receive opacity-only or no decorative motion.

## Copy and safety

Copy is direct, kind and dating-specific. Avoid engagement-pressure language. First-date guidance recommends verified public venues and never claims that AI guarantees safety. Do not expose exact home location, phone number, hidden compatibility fields, private post-date choices or private safety reports.
