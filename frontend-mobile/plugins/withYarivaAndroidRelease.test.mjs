import { expect, it } from "vitest";
import releasePlugin from "./withYarivaAndroidRelease.js";

it("keeps the release signing block separate from resource shrinking on clean and repeat prebuilds", () => {
  const generated = `def projectRoot = rootDir.parent
android {
    defaultConfig {
        versionCode 2
        versionName "0.3.0"
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            def enableShrinkResources = false
        }
    }
}
`;
  const patched = releasePlugin.patchBuildGradle(generated);
  const validLineBreak = "            }\n            def enableShrinkResources";
  expect(patched).toContain(validLineBreak);
  expect(patched).toContain("signingConfig signingConfigs.release");
  expect(patched.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
  expect(releasePlugin.patchBuildGradle(patched)).toBe(patched);
  expect(releasePlugin.patchBuildGradle(patched.replace(validLineBreak, "            }            def enableShrinkResources"))).toBe(patched);
});
