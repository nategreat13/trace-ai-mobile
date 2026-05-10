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

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    "expo-web-browser",
  ],
  extra: {
    ...config.extra,
    devApiUrl,
    devSubscribeUrl,
  },
});
