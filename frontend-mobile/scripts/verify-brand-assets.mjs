import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDirectory);
const brandDirectory = join(projectRoot, "assets", "brand");
const geometry = JSON.parse(readFileSync(join(brandDirectory, "geometry.json"), "utf8"));

const readPng = (name) => PNG.sync.read(readFileSync(join(brandDirectory, name)));

const alphaMetrics = (png) => {
  let transparent = 0;
  let opaque = 0;
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha === 0) transparent += 1;
      if (alpha === 255) opaque += 1;
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return { transparent, opaque, minX, minY, maxX, maxY };
};

for (const name of ["app-icon-ios.png", "app-icon-legacy.png"]) {
  const png = readPng(name);
  const metrics = alphaMetrics(png);
  assert.equal(png.width, 1024, `${name} must be 1024px wide`);
  assert.equal(png.height, 1024, `${name} must be 1024px high`);
  assert.equal(png.alpha, false, `${name} must not contain an alpha channel`);
  assert.equal(metrics.transparent, 0, `${name} must be fully opaque`);
}

for (const name of [
  "adaptive-icon-foreground.png",
  "adaptive-icon-monochrome.png",
  "splash-mark-light.png",
  "splash-mark-dark.png",
]) {
  const png = readPng(name);
  const metrics = alphaMetrics(png);
  assert.equal(png.width, 1024, `${name} must be 1024px wide`);
  assert.equal(png.height, 1024, `${name} must be 1024px high`);
  assert.equal(png.alpha, true, `${name} must contain an alpha channel`);
  assert.ok(metrics.transparent > 0, `${name} must retain a transparent canvas`);
  assert.ok(metrics.opaque > 0, `${name} must contain visible artwork`);
  assert.ok(metrics.minX / png.width >= 0.18, `${name} artwork starts outside the safe zone`);
  assert.ok(metrics.minY / png.height >= 0.18, `${name} artwork starts outside the safe zone`);
  assert.ok(metrics.maxX / png.width <= 0.82, `${name} artwork ends outside the safe zone`);
  assert.ok(metrics.maxY / png.height <= 0.82, `${name} artwork ends outside the safe zone`);
  if (name.startsWith("adaptive-icon-")) {
    assert.ok(metrics.minX / png.width >= 0.22, `${name} needs breathing room on the left`);
    assert.ok(metrics.minY / png.height >= 0.22, `${name} needs breathing room at the top`);
    assert.ok(metrics.maxX / png.width <= 0.78, `${name} needs breathing room on the right`);
    assert.ok(metrics.maxY / png.height <= 0.78, `${name} needs breathing room at the bottom`);
  }
}

assert.deepEqual(
  readFileSync(join(brandDirectory, "splash-mark-light.png")),
  readFileSync(join(brandDirectory, "splash-mark-dark.png")),
  "light and dark splash marks must use the same supplied textured petals",
);

const appConfig = JSON.parse(readFileSync(join(projectRoot, "app.json"), "utf8"));
const packageConfig = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const splashPlugin = appConfig.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
);

assert.equal(appConfig.expo.name, "Yariva");
assert.equal(appConfig.expo.slug, "yariva");
assert.equal(appConfig.expo.userInterfaceStyle, "automatic", "stable launch colors must not disable in-app system theme support");
assert.equal(appConfig.expo.version, packageConfig.version, "app and package versions must stay aligned");
assert.equal(appConfig.expo.icon, "./assets/brand/app-icon-ios.png");
assert.equal(appConfig.expo.android.icon, "./assets/brand/app-icon-legacy.png");
assert.equal(
  appConfig.expo.android.adaptiveIcon.foregroundImage,
  "./assets/brand/adaptive-icon-foreground.png",
);
assert.equal(
  appConfig.expo.android.adaptiveIcon.monochromeImage,
  "./assets/brand/adaptive-icon-monochrome.png",
);
assert.equal(appConfig.expo.android.adaptiveIcon.backgroundColor, geometry.launcherIcon.background);
assert.equal(geometry.launcherIcon.background, "#FFFCFB");
assert.ok(geometry.launcherIcon.markScale <= 0.75, "petals must fit the adaptive mask");
assert.equal(geometry.colors.petalDeep, "#D02560");
for (const name of ["app-icon-ios.png", "app-icon-legacy.png"]) {
  const icon = readPng(name);
  assert.deepEqual(
    Array.from(icon.data.subarray(0, 3)),
    [255, 252, 251],
    `${name} must use the shared warm-ivory background`,
  );
}
assert.ok(Array.isArray(splashPlugin), "expo-splash-screen must be configured");
assert.ok(
  appConfig.expo.plugins.indexOf("./plugins/withYarivaNativeLaunch") < appConfig.expo.plugins.indexOf(splashPlugin),
  "Yariva's native launch plugin must precede expo-splash-screen so its Android style override runs last",
);
assert.equal(splashPlugin[1].image, "./assets/brand/native-launch-continuity.png");
const nativeLaunch = readPng("native-launch-continuity.png");
const nativeArt = alphaMetrics(nativeLaunch);
assert.equal(nativeLaunch.width, 999);
const wordmark = readPng("wordmark-light.png");
const nativeScale = nativeLaunch.width / geometry.nativeLaunch.imageWidthDp;
const wordmarkTop = Math.round(geometry.nativeLaunch.petalSizeDp * nativeScale) + Math.round(5 * nativeScale);
for (let offset = 0; offset < wordmark.data.length; offset += 4) {
  const alpha = wordmark.data[offset + 3];
  const nativeOffset = offset + wordmarkTop * nativeLaunch.width * 4;
  assert.equal(nativeLaunch.data[nativeOffset + 3], alpha, "native splash must preserve wordmark alpha");
  if (alpha > 0) {
    for (let channel = 0; channel < 3; channel += 1) {
      assert.equal(
        nativeLaunch.data[nativeOffset + channel],
        wordmark.data[offset + channel],
        "native splash must preserve visible wordmark pixels",
      );
    }
  }
}
const launchGeometry = geometry.nativeLaunch;
assert.equal(
  nativeLaunch.height,
  wordmarkTop + 315 + Math.round((launchGeometry.taglineGapDp + 2 * launchGeometry.taglineLineHeightDp) * nativeScale),
);
assert.equal(launchGeometry.tagline, "#171719", "launch tagline must use the shared high-contrast ink900");
assert.equal(launchGeometry.taglineFontSizeDp, 16, "native tagline must match shared bodyLarge size");
assert.equal(launchGeometry.taglineLineHeightDp, 24, "native tagline must match shared bodyLarge line height");
assert.ok(nativeArt.transparent > 0, "native launch art must retain a transparent canvas");
assert.ok(nativeArt.opaque > 0, "native launch must show petals, wordmark and tagline");
assert.ok(nativeArt.maxY > wordmarkTop + 315, "native launch must include the tagline below the wordmark");
// Native launch precedes the saved app theme, so both OS modes share the app's light startup.
assert.equal(splashPlugin[1].dark.image, splashPlugin[1].image);
assert.equal(splashPlugin[1].imageWidth, launchGeometry.imageWidthDp);
assert.equal(splashPlugin[1].backgroundColor, geometry.nativeLaunch.background);
assert.equal(splashPlugin[1].dark.backgroundColor, splashPlugin[1].backgroundColor);

const nativeResources = join(projectRoot, "android", "app", "src", "main", "res");
if (existsSync(nativeResources)) {
  const adaptiveXml = readFileSync(
    join(nativeResources, "mipmap-anydpi-v26", "ic_launcher.xml"),
    "utf8",
  );
  const lightColors = readFileSync(join(nativeResources, "values", "colors.xml"), "utf8");
  const darkColors = readFileSync(join(nativeResources, "values-night", "colors.xml"), "utf8");
  const styles = readFileSync(join(nativeResources, "values", "styles.xml"), "utf8");
  assert.match(adaptiveXml, /@mipmap\/ic_launcher_foreground/);
  assert.match(adaptiveXml, /@mipmap\/ic_launcher_monochrome/);
  assert.ok(lightColors.includes(`<color name="splashscreen_background">${geometry.nativeLaunch.background}</color>`));
  assert.ok(
    lightColors.includes(`<color name="iconBackground">${geometry.launcherIcon.background}</color>`),
    "native Android launcher background must match the generated monogram",
  );
  assert.ok(darkColors.includes(`<color name="splashscreen_background">${geometry.nativeLaunch.background}</color>`));
  assert.match(
    styles,
    /<item name="windowSplashScreenAnimatedIcon">@android:color\/transparent<\/item>/,
    "Android's masked first-frame icon must not show a blurry copy of the launch artwork",
  );
  assert.deepEqual(
    readFileSync(join(nativeResources, "drawable-night-xxxhdpi", "splashscreen_logo.png")),
    readFileSync(join(nativeResources, "drawable-xxxhdpi", "splashscreen_logo.png")),
    "OS night mode must not switch the native launch backdrop to a different appearance",
  );
  for (const directory of ["drawable-xxxhdpi", "drawable-night-xxxhdpi"]) {
    const splash = PNG.sync.read(
      readFileSync(join(nativeResources, directory, "splashscreen_logo.png")),
    );
    const metrics = alphaMetrics(splash);
    assert.ok(metrics.opaque > 0, "native launch must display the matching splash art");
    assert.ok(metrics.transparent > 0, "native launch must retain a transparent art canvas");
    assert.ok(metrics.minX > 0 && metrics.maxX < splash.width - 1);
    assert.ok(metrics.minY > 0 && metrics.maxY < splash.height - 1);
  }
}

console.log(
  "Yariva petal launcher and continuous native/in-app splash passed dimensions, opacity, native, and config checks.",
);
