# Pearl luxury theme QA

## Petal-button device verification — 2026-08-13

**Comparison target**

- Source state before the requested colour correction: `tmp/photo-led-qa-2026-08-13/20-app-running-installed-bundle.png`
- Updated implementation: `tmp/photo-led-qa-2026-08-13/21-petal-theme-on-device.png`
- Device / viewport: physical Samsung SM-G990E, 1080 × 2340 px capture (same device and unauthenticated Login state).

**Findings and correction**

- **P1 — CTA was read as orange/coral.** The previous installed Login button used the older coral primary. This conflicted with the requested no-orange, romantic-but-premium direction.
  - **Fix:** changed the central `heartline` brand scale in `src/theme/colors.ts` to muted petal pink (`brand #C86E91`, `brandStrong #AD5679`, `brandDeep #8A405F`). `Button` reads `palette.brand`, so this applies consistently to every primary CTA without per-screen overrides.
- **P1 — Button visual weight and spacing.** The previous auth state presented a taller, more dominant CTA too close to the form.
  - **Fix:** the shared medium button remains 44dp, with auth action containers keeping a 24dp field-to-CTA gap. The resulting capture shows a compact CTA with breathing room above and below.

**Visual comparison**

- The before and after captures are the identical Login screen state at the identical 1080 × 2340 physical-device resolution. The updated image verifies: warm ivory canvas, deep plum hierarchy, petal-pink primary CTA, and no orange primary action.
- No visible clipping, overlap, or unreadable text was found in the on-device state. Teal remains reserved for verification/safety, not primary actions.

**Validation**

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed: 5 files, 27 tests.
- Installed and launched the signed device APK: `dist/Yariva-v0.2.4-petal-theme-phone.apk` (29 MB).

final result: passed

**Comparison target**

- Source visual truth: `/var/folders/dv/2p34_9f12ls4x7jz1c7jqw700000gn/T/codex-clipboard-2a9437ac-1ef8-4856-ac9f-aeff16241990.png`
- Implementation: `http://127.0.0.1:8090/discover`
- Final implementation capture: `tmp/forest-glass-qa-2026-08-11/08-discover-pearl-mobile-393x852.png`
- Full-view comparison: `tmp/forest-glass-qa-2026-08-11/09-reference-mobile-comparison.png`
- Source pixels: 1024 × 1024. It contains two separate 512 px-wide phone mockups.
- Implementation pixels / CSS viewport / density: 393 × 852 / 393 × 852 / 1×.
- State: source is a luxury retail-style mobile mockup; implementation is Yariva’s populated Discover feed in light theme. The requested transfer is the palette and material language only, not the retail layout, product imagery, or copy.

**Findings**

- No actionable P0, P1, or P2 issues remain for the requested shared theme update.
- [P3] The reference’s mist-blue backdrop is deliberately restrained in the Discover feed.
  - Location: shared secondary tokens in `src/theme/colors.ts`.
  - Evidence: the source uses blue behind its retail discovery panel; Yariva applies mist blue to secondary and informational states, while the primary feed remains pearl so real profile photographs stay the visual focus.
  - Impact: this is a deliberate product-domain difference, not a usability or consistency issue.
  - Follow-up: introduce a very subtle mist-blue backdrop only if a later visual review shows it is needed outside photo-forward screens.

**Required fidelity surfaces**

- Fonts and typography: the existing Fraunces display heads, Inter UI text, and Yariva wordmark remain crisp and readable at the 393 px mobile viewport. The reference’s thin black luxury typography is matched in hierarchy, rather than copying its garbled AI-generated retail text.
- Spacing and layout rhythm: the mobile header, profile card, action rail, and fixed navigation stay aligned and fully visible; no persistent control is cropped. The two products have intentionally different information architecture.
- Colors and visual tokens: the former forest/pista token system was replaced centrally with pearl (`#F6F0EC`), warm white glass, muted champagne/peach primary states, mist-blue secondary states, quiet gold, and charcoal text. The coral logo dot remains logo-only, not a UI accent.
- Image quality and assets: Yariva keeps its real profile and supplied logo assets; no plant, car, jewelry, diamond, or AI-generated retail asset from the reference was copied into the dating experience. The profile image is sharp and correctly cropped.
- Copy and content: dating-first copy, safety/verification status, and relationship-intent content remain product-specific and legible; retail copy was intentionally not transferred.

**Comparison history**

1. **P1 — wrong visual direction.** An earlier implementation interpreted a different Pinterest asset as dark forest/pista glass. The user supplied the exact selected screenshot, which clearly establishes a light pearl, champagne-peach, and mist-blue direction. **Fix:** reworked the shared `lightPalette`, `darkPalette`, live brand tokens, gradients, shadows, and default first-launch preference in `src/theme/colors.ts`, `src/theme/shadows.ts`, and `src/theme/ThemeContext.tsx`; no screen-specific colour forks were introduced. Earlier dark evidence: `tmp/forest-glass-qa-2026-08-11/01-discover-dark.png`.
2. **Post-fix verification.** Captured the final mobile Discover state at 393 × 852 and compared it side by side with the exact user-supplied reference in `tmp/forest-glass-qa-2026-08-11/09-reference-mobile-comparison.png`. The pearl background, champagne primary treatment, fine borders, warm-white surfaces, and restrained soft contrast now align with the selected material language. No focused crop was necessary because all relevant header, card, badge, intent pill, and navigation treatments are legible in the full mobile comparison.
3. **Welcome follow-up — audit refinements.** The accepted Welcome audit identified an overly large card-to-headline gap and legal copy that was too small/light. **Fix:** raised the content block by increasing its safe-area reserve and changed the legal line from `micro`/`textSubdued` to `caption`/`textSecondary` in `src/features/auth/WelcomeScreen.tsx`. Post-fix visual evidence: `tmp/welcome-audit-2026-08-11/03-welcome-final.png`. The headline is visibly closer to the portrait stack and the legal line is readable without competing with the CTAs.
4. **Splash follow-up — text sharpness.** The previous splash crop scaled a large raster canvas inside a clipping view, making the wordmark and small tagline look soft. **Fix:** created tight source-derived wordmark assets, render the wordmark at its natural aspect ratio with `contain`, and raised the tagline to `body`/`textSecondary` in `src/components/ui/ArohaMark.tsx` and `src/features/auth/SplashScreen.tsx`. Post-fix visual evidence: `tmp/splash-audit-2026-08-11/03-splash-sharp.png`.

**Implementation checklist**

- [x] Replace green forest/pista shared tokens with the selected pearl luxury palette.
- [x] Preserve one shared theme source for all pages and modes.
- [x] Keep light pearl as the initial Yariva experience; retain user-selectable dark mode.
- [x] Verify Discover, Date Plans, and Activity screens in the browser.
- [x] Verify the Welcome refinement in the browser.
- [x] Verify the Splash wordmark and tagline sharpness in the browser.
- [x] Pass static validation: `npm run typecheck`, `npm run lint`, and `npm test` (5 files / 25 tests).

**Follow-up polish**

- If desired after hands-on review, test a low-opacity mist-blue wash behind non-photo utility screens only.

final result: passed
