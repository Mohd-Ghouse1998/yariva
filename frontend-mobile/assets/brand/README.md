# Yariva brand assets

`petal-artwork.png` is the transparent cutout of the three textured petals in
the user's supplied logo. `geometry.json` stores layout and colour settings for
the launcher and native launch art. The original lettering comes from
`assets/yariva-wordmark.png` through its existing tight transparent crop;
the generator only recolors its dot to fit the petal palette. The cutout is
also the source for the in-app mark, launcher and splash; do not recreate it
with simplified shapes.

Run `npm run brand:generate` to regenerate the committed PNG exports,
then run `npm run brand:verify`. Native launcher resources are generated from these exports by
Expo prebuild. Android draws a native launch layer before JavaScript starts.
Its generated artwork combines the petal mark, original wordmark and the app's
Inter tagline at the same 152 dp width as
`src/features/auth/SplashScreen.tsx`; both OS modes use the shared pearl
background (`#FFFCFB`). This makes the native-to-React handoff one continuous
branded splash rather than a blank backdrop followed by a second page.
Keep the native splash visible until fonts have resolved and the app root has laid out; a font
error must allow fallback fonts rather than trapping startup. Native splash
changes require rebuilding/installing the app, not just a Metro reload.

Rules:

- Never put a background into `adaptive-icon-foreground.png`.
- Keep the petal mark inside the Android adaptive-icon safe zone.
- Never add a wordmark, tagline, shadow, photograph, or rounded mask to an app
  icon. The operating system applies its own mask.
- `app-icon-ios.png` and `app-icon-legacy.png` must remain fully opaque.
- Light and dark splash exports must remain transparent and preserve the
  supplied petal texture.
- Do not manually crop a wordmark to recreate the standalone mark.

## Release identity

`app.json` is the release-version source used by Expo and Android Gradle. Keep
the private npm package version aligned with it. The public name is Yariva, but
the existing `com.aroha.mobile` application ID and `aroha://` scheme remain as
compatibility identifiers so installed upgrades, deep links, and local sessions
continue to work.

Android release signing never falls back to the debug certificate. Supply these
values from CI secrets, environment variables, or an uncommitted user-level
Gradle properties file; use an absolute keystore path:

- `YARIVA_RELEASE_STORE_FILE`
- `YARIVA_RELEASE_STORE_PASSWORD`
- `YARIVA_RELEASE_KEY_ALIAS`
- `YARIVA_RELEASE_KEY_PASSWORD`

Do not commit the keystore or any of these values.

`plugins/withYarivaAndroidRelease.js` reapplies this policy whenever Expo
generates a clean Android project, because the native folders are intentionally
ignored. If Expo changes its generated Gradle structure, prebuild fails loudly
instead of silently restoring debug signing.
