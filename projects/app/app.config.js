// `yarn dev2` sets USE_LOCAL_API=1 — the default for mobile dev so the app
// talks to your local server (running via `yarn dev1`) and you can iterate
// on server changes without a deploy. Run `yarn dev:prod` to opt out and
// point at the deployed production API instead (useful for UI-only work
// when you don't want to run dev1, or for repro'ing prod-only behavior).
const useLocalApi =
  process.env.USE_LOCAL_API === "1" || process.env.USE_LOCAL_API === "true";

const isCodespaces = process.env.CODESPACES === "true";

const localApiUrl = isCodespaces
  ? "https://opulent-space-train-pjxwjr9qpvqv26xpx-3001.app.github.dev"
  : "http://localhost:3001";

const localSubscribeUrl = isCodespaces
  ? "https://opulent-space-train-pjxwjr9qpvqv26xpx-3000.app.github.dev/subscribe"
  : "http://localhost:3002/subscribe";

const devApiUrl = useLocalApi ? localApiUrl : null;
const devSubscribeUrl = useLocalApi ? localSubscribeUrl : null;

// Build metadata — git SHA + UTC unix timestamp at build time. Surfaced
// on the in-app diagnostics screen so we can identify exactly which
// commit a user is running. Populated by:
//   - EAS Build:  eas-build-pre-install.sh writes build-info.json
//                 from `git rev-parse --short HEAD`.
//   - Local dev:  the `prestart` script in package.json runs the same
//                 hook before `expo start`.
//   - OTA:        each OTA bundle is built fresh, so the SHA matches
//                 the bundle the user actually downloaded.
// Fallback values (unknown / 0) are used if build-info.json is missing
// — e.g. on a fresh clone before the first `yarn start`.
let buildInfo = { gitSha: "unknown", buildTimestamp: 0 };
try {
  buildInfo = require("./build-info.json");
} catch {
  // Missing file — fall back to defaults above. Don't block config.
}

// Two different Mapbox tokens, neither committed:
//
//   MAPBOX_DOWNLOAD_TOKEN — secret (sk.…, scope DOWNLOADS:READ). Used at
//     build time to pull the native SDK from Mapbox's private artifact
//     repo. Absent, the JS installs fine and only the native build fails,
//     with a Mapbox 401 during pod install.
//
//   MAPBOX_PUBLIC_TOKEN — public (pk.…). Baked into the binary at build
//     time and used by the map at runtime. It is genuinely public — any
//     user can extract it from the app, which is how Mapbox intends it —
//     but it still isn't committed, because GitHub's secret scanner blocks
//     pushes containing any Mapbox token and bypassing that check is a
//     worse habit than passing one more env var. Absent, DealsMap renders
//     an explanatory placeholder rather than a blank grey rectangle.
//
// Both are set as EAS secrets; export them locally for a local native build.
const mapboxDownloadToken = process.env.MAPBOX_DOWNLOAD_TOKEN ?? undefined;
const mapboxPublicToken = process.env.MAPBOX_PUBLIC_TOKEN ?? null;

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    "expo-web-browser",
    ["@rnmapbox/maps", { RNMapboxMapsDownloadToken: mapboxDownloadToken }],
  ],
  extra: {
    ...config.extra,
    devApiUrl,
    devSubscribeUrl,
    mapboxPublicToken,
    gitSha: buildInfo.gitSha,
    buildTimestamp: buildInfo.buildTimestamp,
  },
});
