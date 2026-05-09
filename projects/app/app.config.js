// Set USE_LOCAL_API=1 (e.g. via the `yarn dev2:local` script) when you're
// also running `yarn dev1` and want the mobile app to talk to your local
// server instead of production. Without this opt-in, devApiUrl is null and
// constants.ts falls back to the production API URL — which is the right
// default 99% of the time (UI/copy work doesn't need a local server).
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
