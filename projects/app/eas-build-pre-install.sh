#!/usr/bin/env bash
# EAS Build hook: writes the current git SHA + UTC build timestamp to
# `build-info.json` in this project, which app.config.js then merges into
# `expo.extra` so the diagnostics screen can display it.
#
# Why a pre-install hook (not a Node script): EAS Build runs this with
# the repo checked out and `git` available. By the time JS runs, the
# bundler has already snapshotted `app.config.js`, so a runtime
# fallback wouldn't reach app.config.js's `extra` block.
#
# Local dev: `package.json` has a `prestart` script that runs the same
# logic (writes build-info.json) before `expo start`, so the SHA shown
# in dev matches the SHA of the working tree at start time.
set -euo pipefail

cd "$(dirname "$0")"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
BUILD_TIMESTAMP="$(date -u +%s)"

cat > build-info.json <<EOF
{
  "gitSha": "${GIT_SHA}",
  "buildTimestamp": ${BUILD_TIMESTAMP}
}
EOF

echo "[eas-build-pre-install] wrote build-info.json: ${GIT_SHA} @ ${BUILD_TIMESTAMP}"
