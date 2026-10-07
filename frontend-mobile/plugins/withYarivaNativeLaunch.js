const { AndroidConfig, withAndroidStyles, withDangerousMod, withMainActivity } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
const { nativeLaunch } = require("../assets/brand/geometry.json");

function nativeColor(glow) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(glow.color);
  if (!match || glow.opacity < 0 || glow.opacity > 1) {
    throw new Error("Yariva native launch glow needs a hex RGB color and 0–1 opacity.");
  }
  const channels = match.slice(1).map((channel) => parseInt(channel, 16));
  return `Color.argb(${Math.round(glow.opacity * 255)}, ${channels.join(", ")})`;
}

// Android 12+ only permits a solid colour and a centered icon in the OS-owned
// first frame. This native overlay is the earliest full-screen Yariva surface:
// it is drawn before React/Metro and removed when React first paints content.
const imports = `import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarkerConstants
`;

const activityMembers = `  // @yariva-native-launch: keep the centered petal art and corner glows visible while JS starts.
  private var yarivaLaunchOverlay: FrameLayout? = null
  private var yarivaContentAppeared = false
  private val yarivaContentListener = ReactMarker.MarkerListener { name, _, _ ->
    if (name == ReactMarkerConstants.CONTENT_APPEARED) {
      yarivaContentAppeared = true
      runOnUiThread { removeYarivaLaunchOverlay() }
    }
  }

  private fun launchDp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private fun launchBubble(color: Int): View = View(this).apply {
    background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(color)
    }
  }

  private fun launchPetal(drawableId: Int, opacity: Float, angle: Float): ImageView =
    ImageView(this).apply {
      setImageResource(drawableId)
      scaleType = ImageView.ScaleType.FIT_CENTER
      alpha = opacity
      rotation = angle
    }

  private fun showYarivaLaunchOverlay() {
    if (yarivaContentAppeared) return
    val content = findViewById<FrameLayout>(android.R.id.content)
    val overlay = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("${nativeLaunch.background}"))
      isClickable = true
      clipChildren = true
      addView(
        launchBubble(${nativeColor(nativeLaunch.glows.topRight)}),
        FrameLayout.LayoutParams(launchDp(${nativeLaunch.glows.topRight.sizeDp}), launchDp(${nativeLaunch.glows.topRight.sizeDp}), Gravity.TOP or Gravity.RIGHT).apply {
          topMargin = launchDp(${nativeLaunch.glows.topRight.topDp})
          rightMargin = launchDp(${nativeLaunch.glows.topRight.rightDp})
        },
      )
      addView(
        launchBubble(${nativeColor(nativeLaunch.glows.bottomLeft)}),
        FrameLayout.LayoutParams(launchDp(${nativeLaunch.glows.bottomLeft.sizeDp}), launchDp(${nativeLaunch.glows.bottomLeft.sizeDp}), Gravity.BOTTOM or Gravity.LEFT).apply {
          bottomMargin = launchDp(${nativeLaunch.glows.bottomLeft.bottomDp})
          leftMargin = launchDp(${nativeLaunch.glows.bottomLeft.leftDp})
        },
      )
      // Match the JS splash backdrop, so petals are present before Metro starts.
      addView(
        launchPetal(R.drawable.yariva_petal_upright, 0.32f, 17f),
        FrameLayout.LayoutParams(launchDp(152), launchDp(152), Gravity.TOP or Gravity.RIGHT).apply {
          topMargin = launchDp(16)
          rightMargin = launchDp(-58)
        },
      )
      addView(
        launchPetal(R.drawable.yariva_petal_curved, 0.28f, -18f),
        FrameLayout.LayoutParams(launchDp(130), launchDp(130), Gravity.BOTTOM or Gravity.LEFT).apply {
          bottomMargin = launchDp(20)
          leftMargin = launchDp(-50)
        },
      )
      addView(
        ImageView(this@MainActivity).apply {
          setImageResource(R.drawable.splashscreen_logo)
          scaleType = ImageView.ScaleType.FIT_CENTER
        },
        FrameLayout.LayoutParams(launchDp(288), launchDp(288), Gravity.CENTER),
      )
    }
    content.addView(
      overlay,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    yarivaLaunchOverlay = overlay
    Log.i("YarivaLaunch", "Native brand and corner glows attached before React")
  }

  private fun removeYarivaLaunchOverlay() {
    yarivaLaunchOverlay?.let { overlay ->
      (overlay.parent as? ViewGroup)?.removeView(overlay)
      yarivaLaunchOverlay = null
      Log.i("YarivaLaunch", "React content appeared; native overlay removed")
    }
    ReactMarker.removeListener(yarivaContentListener)
  }

  override fun onDestroy() {
    ReactMarker.removeListener(yarivaContentListener)
    yarivaLaunchOverlay = null
    super.onDestroy()
  }

`;

const launchOnCreate = `    ReactMarker.addListener(yarivaContentListener)
    super.onCreate(null)
    showYarivaLaunchOverlay()
    // Reveal the ready native layer without Expo's 400 ms system-splash fade.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      splashScreen.setOnExitAnimationListener { it.remove() }
    }
    SplashScreenManager.hide()`;

function patchMainActivity(contents) {
  if (!contents.includes("import expo.modules.splashscreen.SplashScreenManager")) {
    throw new Error("Yariva native launch plugin expected expo-splash-screen in MainActivity.");
  }
  if (!contents.includes("class MainActivity : ReactActivity() {")) {
    throw new Error("Yariva native launch plugin expected a Kotlin ReactActivity.");
  }
  if (!contents.includes("    super.onCreate(null)")) {
    throw new Error("Yariva native launch plugin could not find MainActivity.onCreate.");
  }
  if (contents.includes("// @yariva-native-launch:")) {
    const memberStart = contents.indexOf("  // @yariva-native-launch:");
    const memberEnd = contents.indexOf("  override fun onCreate(", memberStart);
    if (memberEnd < 0) throw new Error("Yariva native launch member boundary is missing.");
    const refreshed = contents.slice(0, memberStart) + activityMembers + contents.slice(memberEnd);
    const withLogImport = refreshed.includes("import android.util.Log")
      ? refreshed
      : refreshed.replace(
          "import android.graphics.drawable.GradientDrawable\n",
          "import android.graphics.drawable.GradientDrawable\nimport android.util.Log\n",
        );
    return withLogImport.replace(
        /    ReactMarker\.addListener\(yarivaContentListener\)[\s\S]*?    SplashScreenManager\.hide\(\)/,
        launchOnCreate,
      );
  }
  return contents
    .replace("import expo.modules.splashscreen.SplashScreenManager\n", `import expo.modules.splashscreen.SplashScreenManager\n${imports}`)
    .replace("class MainActivity : ReactActivity() {\n", `class MainActivity : ReactActivity() {\n${activityMembers}`)
    .replace("    super.onCreate(null)", launchOnCreate);
}

module.exports = (config) => {
  // Android 12 owns the first launch frame and scales/masks this icon as an app
  // icon. The full wordmark becomes soft there, so show the matching canvas
  // until our native full-resolution overlay is attached.
  config = withAndroidStyles(config, (modConfig) => {
    modConfig.modResults = AndroidConfig.Styles.assignStylesValue(modConfig.modResults, {
      add: true,
      parent: { name: "Theme.App.SplashScreen" },
      name: "windowSplashScreenAnimatedIcon",
      value: "@android:color/transparent",
    });
    return modConfig;
  });

  config = withDangerousMod(config, ["android", async (modConfig) => {
    const drawableDir = path.join(modConfig.modRequest.platformProjectRoot, "app/src/main/res/drawable-nodpi");
    fs.mkdirSync(drawableDir, { recursive: true });
    for (const shape of ["upright", "curved"]) {
      fs.copyFileSync(
        path.join(modConfig.modRequest.projectRoot, `assets/brand/match-petal-${shape}.png`),
        path.join(drawableDir, `yariva_petal_${shape}.png`),
      );
    }
    return modConfig;
  }]);

  return withMainActivity(config, (modConfig) => {
    if (modConfig.modResults.language !== "kt") {
      throw new Error("Yariva native launch currently requires a Kotlin MainActivity.");
    }
    modConfig.modResults.contents = patchMainActivity(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports.patchMainActivity = patchMainActivity;
