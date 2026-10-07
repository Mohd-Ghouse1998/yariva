const { withAppBuildGradle } = require("@expo/config-plugins");

const SIGNING_KEYS = [
  "YARIVA_RELEASE_STORE_FILE",
  "YARIVA_RELEASE_STORE_PASSWORD",
  "YARIVA_RELEASE_KEY_ALIAS",
  "YARIVA_RELEASE_KEY_PASSWORD",
];

const topLevelConfig = `
def expoConfigFile = file("\${projectRoot}/app.json")
def expoConfig = new groovy.json.JsonSlurper().parse(expoConfigFile).expo
def yarivaVersionName = expoConfig.version?.toString()
// Split the key so Expo's native version sync does not rewrite this helper
// as though it were the Android DSL declaration during a later prebuild.
def yarivaVersionCode = expoConfig.android?.get("version" + "Code") as Integer

if (!(yarivaVersionName ==~ /\\d+\\.\\d+\\.\\d+/) || yarivaVersionCode == null || yarivaVersionCode < 1) {
    throw new GradleException("app.json must define a semantic expo.version and positive Android build code.")
}

def releaseSigning = [
    storeFile: findProperty("YARIVA_RELEASE_STORE_FILE") ?: System.getenv("YARIVA_RELEASE_STORE_FILE"),
    storePassword: findProperty("YARIVA_RELEASE_STORE_PASSWORD") ?: System.getenv("YARIVA_RELEASE_STORE_PASSWORD"),
    keyAlias: findProperty("YARIVA_RELEASE_KEY_ALIAS") ?: System.getenv("YARIVA_RELEASE_KEY_ALIAS"),
    keyPassword: findProperty("YARIVA_RELEASE_KEY_PASSWORD") ?: System.getenv("YARIVA_RELEASE_KEY_PASSWORD"),
]
def missingReleaseSigning = releaseSigning.findAll { _, value -> value == null || value.toString().trim().isEmpty() }.keySet()
def releaseSigningReady = missingReleaseSigning.isEmpty()

gradle.taskGraph.whenReady { taskGraph ->
    def releaseTaskRequested = taskGraph.allTasks.any { task ->
        task.project == project && task.name.toLowerCase().contains("release")
    }
    if (releaseTaskRequested && !releaseSigningReady) {
        throw new GradleException(
            "Yariva release signing is not configured. Set ${SIGNING_KEYS.join(", ")} " +
            "through Gradle properties or environment variables. Missing fields: " +
            missingReleaseSigning.join(', ')
        )
    }
    if (releaseTaskRequested && !file(releaseSigning.storeFile.toString()).exists()) {
        throw new GradleException("Yariva release keystore does not exist at the configured path.")
    }
}
`;

const releaseSigningConfig = `    if (releaseSigningReady) {
        signingConfigs.create("release") {
            storeFile file(releaseSigning.storeFile.toString())
            storePassword releaseSigning.storePassword.toString()
            keyAlias releaseSigning.keyAlias.toString()
            keyPassword releaseSigning.keyPassword.toString()
        }
    }

`;

function patchBuildGradle(contents) {
  // Native folders are generated and ignored. Preserve an already-patched local
  // tree, while ensuring a clean EAS/prebuild receives the same policy.
  if (contents.includes("def releaseSigning = [")) return contents;

  const projectRootPattern = /(def projectRoot =[^\n]+\n)/;
  if (!projectRootPattern.test(contents)) {
    throw new Error("Yariva release plugin could not find the Expo projectRoot declaration.");
  }
  let next = contents.replace(projectRootPattern, `$1${topLevelConfig}`);

  const versionCodePattern = /(^\s*)versionCode\s+\d+\s*$/m;
  const versionNamePattern = /(^\s*)versionName\s+["'][^"']+["']\s*$/m;
  if (!versionCodePattern.test(next) || !versionNamePattern.test(next)) {
    throw new Error("Yariva release plugin could not find Android version declarations.");
  }
  next = next
    .replace(versionCodePattern, "$1// app.json is the single Expo and Gradle release-version source.\n$1versionCode yarivaVersionCode")
    .replace(versionNamePattern, "$1versionName yarivaVersionName");

  const buildTypesAnchor = "    buildTypes {";
  const buildTypesIndex = next.indexOf(buildTypesAnchor);
  if (buildTypesIndex < 0) {
    throw new Error("Yariva release plugin could not find the Android buildTypes block.");
  }
  next = `${next.slice(0, buildTypesIndex)}${releaseSigningConfig}${next.slice(buildTypesIndex)}`;

  const releaseIndex = next.indexOf("        release {", buildTypesIndex);
  const shrinkIndex = next.indexOf("            def enableShrinkResources", releaseIndex);
  if (releaseIndex < 0 || shrinkIndex < 0) {
    throw new Error("Yariva release plugin could not find the Android release build type.");
  }
  const releasePrefix = next.slice(releaseIndex, shrinkIndex);
  if (!releasePrefix.includes("signingConfig signingConfigs.debug")) {
    throw new Error("Yariva release plugin expected Expo's debug-signing fallback but did not find it.");
  }
  const secureReleasePrefix = releasePrefix.replace(
    /^\s*signingConfig signingConfigs\.debug\s*$/m,
    "            // Release must never fall back to the debug certificate.\n" +
      "            if (releaseSigningReady) {\n" +
      "                signingConfig signingConfigs.release\n" +
      "            }",
  );
  return `${next.slice(0, releaseIndex)}${secureReleasePrefix}${next.slice(shrinkIndex)}`;
}

module.exports = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("Yariva release signing currently requires a Groovy app/build.gradle.");
    }
    modConfig.modResults.contents = patchBuildGradle(modConfig.modResults.contents);
    return modConfig;
  });

module.exports.patchBuildGradle = patchBuildGradle;
