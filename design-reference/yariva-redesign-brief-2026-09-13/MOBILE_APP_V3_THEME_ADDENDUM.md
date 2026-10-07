# Yariva — use the mobile_app_v3 design foundation

This updates the visual direction in the earlier Yariva brief. Keep its product capabilities and business rules. Replace the narrow-serif editorial direction with the typography, component treatment and responsive principles of the existing `mobile_app_v3` project, adapted to a contemporary dating identity.

The specifications below were read from current local source on 13 September 2026. They let a designer use the reference without repository access. This review does not certify that every existing v3 screen implements those rules correctly.

## Verified v3 foundation

Source project: `/Users/mohdghouse/Desktop/new/Backend/mobile_app_v3`.

| Element | Existing reference |
| --- | --- |
| Display/headings | Space Grotesk 600 |
| Supporting numeric typography | Space Grotesk 500/600 |
| Body | Inter 400 |
| Medium emphasis and secondary controls | Inter 500 |
| Strong text and primary button labels | Inter 600 |
| Type starting points | Display 22/27; title 17/22; body 14/20; secondary text 12.5/17 (size/line height in logical units) |
| Primary action | Filled brand color, contrasting text; one dominant committing action per screen |
| Secondary action | Outlined with neutral surface and text |
| Tertiary action | Quiet text treatment |
| Destructive action | Outlined semantic-danger treatment |
| Button geometry | 44dp resting visual height, 42dp below 360dp width, 10dp radius; effective target increased to 48dp |
| Button labels | Inter 600 primary, Inter 500 other tiers; normal 14, compact 13.5; wrap/grow when needed |
| Loading buttons | Preserve measured width; spinner replaces visible content without moving the layout |
| Standard inputs | 46dp minimum height, 12dp radius, 12dp horizontal padding; separate label and inline hint/error |
| Input states | Neutral border; brand-color focus; error-color border; subdued disabled surface; leading/trailing adornments |
| Multiline inputs | Minimum 88dp; content starts at the top |
| Cards / sheets | 14dp card radius; 20dp sheet radius; restrained borders/shadows |
| Screen gutters | 20dp normally, 16dp below 360dp width |
| Action width | Maximum 560dp on wide layouts |
| Responsive rules | Compact below 360dp; wide at 600dp; short portrait viewport below 760dp height; landscape-aware |
| Action rows | Stack below 340dp, or at larger text scales on phone widths |
| Tab bar | Source tokens specify 52dp, compact 50dp; adapt measured safe-area and content clearance |
| Themes | Semantic light/dark surface, text, border, brand, pressed, disabled, information, success, warning and danger roles |

The v3 label token is only 9.5dp. Do not copy that tiny size into important form labels or navigation. Retain the font families and relative hierarchy while improving legibility. Dating bios, messages and longer reading content may need 15–16dp Inter. These are proposed refinements, not existing v3 token values. Let controls grow for larger text; do not reproduce restrictive font-scaling behavior merely because it exists in the reference.

## Updated color direction — compare modern palettes

This section supersedes the earlier berry/blush/plum proposal. The user wants a premium, contemporary theme and has questioned the assumption that a dating app should use pink or cherry colors. Do not default to pink, cherry, berry or rose for Yariva's identity.

Retain v3's component styling and hierarchy. Use neutral surfaces, clear text contrast and a deliberate accent. Dating character should come from people, photography, language, profile composition and mutual-connection moments; it does not require a stereotypically romantic palette.

Keep typography, content, portraits, buttons and layout identical while comparing these three proposed color directions on the same Discover screen:

| Direction | Palette character | What to assess |
| --- | --- | --- |
| Graphite + cobalt | Soft off-white surfaces, graphite text, crisp cobalt primary actions | Clear emphasis and a contemporary character without letting blue dominate the portraits |
| Pearl + deep teal | Pearl/white surfaces, charcoal text, rich teal actions | A calmer identity with sufficient contrast and a distinct feel from the EV reference |
| Charcoal + restrained lime | Charcoal dark surfaces, clear light text, limited lime highlights; corresponding neutral light theme | More expressive character while keeping accents controlled and reading surfaces comfortable |

These are exploration directions, not approved final colors. Recommend one based on its actual screen previews. Show the corresponding dark/light treatment and key selected/focus/error states. Let the user select the palette before propagating it through every screen.

Define exact semantic tokens once selected. Keep errors, warnings and success distinct from brand accents using labels and icons as well as color. Red may still serve its conventional error/destructive role. Specify the secondary accent explicitly rather than carrying over v3's automatic greenward derivation. Check final text, button, border, focus and overlay combinations for contrast.

## What to preserve and what to adapt

Preserve the recognizable font combination, button hierarchy, field styling, consistent spacing, coherent sheets/cards, responsive behavior, keyboard clearance and safe-area discipline. Keep the app recognizably related to the v3 design foundation.

Adapt content hierarchy for people and conversations: real adult portraits, readable bios, personality prompts, mutual-interest feedback, chat and date invitations. Do not transfer charging maps, wallet dashboards, energy gauges, EV icons or unrelated business workflows.

Modernize through composition, quality photography, concise copy, component refinement, restrained motion and stronger visual hierarchy. Avoid adding excessive gradients, glass effects or oversized controls as a shortcut to a premium feel.

The brand-name/logo exploration can remain a separate workstream. This visual update does not select a different brand name.

## Next design deliverable

1. Compare the three color directions on the same Discover screen, with fixed v3 typography/components and actual portraits. Recommend one for user selection.
2. With the selected palette, create a foundation sheet showing the exact fonts, semantic colors, button tiers, input states, cards, sheets, navigation and spacing. Apply it to Discover, Full Profile, Connections, Chat and Date Plan using realistic content and actual portraits.
3. Show at 390px and 320px widths, with a representative Android size, large text, keyboard-open forms and corresponding dark screens. Do not simply scale a fixed screenshot down.
4. Keep developer annotations outside the app frames. Retain the corrections from the PDF review: honest onboarding progress, clear multi-select controls, truthful offline/pass behavior and no apparently working unsupported filters.
5. Keep artifacts editable, using reusable Figma components and semantic variables where the environment supports Figma authoring. Mark untested behavior and missing integrations honestly.

## Source references

All paths below are relative to `mobile_app_v3/`:

- `src/theme/tokens.ts`: fonts, type ramp, radii, sizing, semantic palettes and brand-color derivation.
- `src/theme/responsive.ts`: compact/wide/short-screen/text-scale layout rules.
- `src/components/Button.tsx`: button hierarchy, geometry, wrapping, touch area and loading behavior.
- `src/components/Field.tsx`: labels, input geometry, focus/error/disabled state and adornments.
- `src/components/ScreenFooter.tsx`: constrained sticky actions and bottom-clearance integration.
- `src/components/ui.tsx`: shared text, cards, chips and related controls.
- `App.tsx`: actual Inter and Space Grotesk font registration.
