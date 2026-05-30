/**
 * Expo config plugin that strips the `com.google.android.gms.permission.AD_ID`
 * permission from the merged Android manifest at prebuild time.
 *
 * Why this exists:
 *   The Meta SDK's Android library (`react-native-fbsdk-next` → FBSDKCoreKit)
 *   declares the AD_ID permission in its packaged manifest. Even though we
 *   set `advertiserIDCollectionEnabled: false` in the plugin config — which
 *   prevents the SDK from actually *reading* the Google Play Services AAID
 *   at runtime — the permission still gets merged into our app's final
 *   AndroidManifest.xml during Gradle's manifest-merge step.
 *
 *   Google Play's data-safety review treats the presence of this permission
 *   in the merged manifest as a claim that the app uses the advertising ID,
 *   and blocks submission if we declare "Does your app use advertising ID?
 *   → No" in the Data Safety form.
 *
 *   This plugin adds a sibling `<uses-permission ... tools:node="remove" />`
 *   directive in our own AndroidManifest, which tells Gradle's manifest
 *   merger to override (i.e. remove) the SDK's contributed permission. The
 *   final APK ships without the AD_ID permission, our Data Safety
 *   declaration matches reality, and Google's automated check passes.
 *
 * If/when we later decide to enable IDFA collection (e.g. for cross-app
 * matching), delete this plugin and flip `advertiserIDCollectionEnabled`
 * to true. Then update the Data Safety form to declare AAID usage.
 */

const { withAndroidManifest } = require("@expo/config-plugins");

const AD_ID_PERMISSION = "com.google.android.gms.permission.AD_ID";

function withoutAdIdPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure the `tools:` namespace is declared so the merger respects
    // tools:node="remove". Without it Gradle silently ignores the attribute.
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    manifest["uses-permission"] = manifest["uses-permission"] || [];

    // If we already declared the permission (we don't, but defensive), make
    // sure it carries the remove directive. Otherwise add a new entry.
    const existing = manifest["uses-permission"].find(
      (p) => p.$["android:name"] === AD_ID_PERMISSION
    );
    if (existing) {
      existing.$["tools:node"] = "remove";
    } else {
      manifest["uses-permission"].push({
        $: {
          "android:name": AD_ID_PERMISSION,
          "tools:node": "remove",
        },
      });
    }

    return config;
  });
}

module.exports = withoutAdIdPermission;
