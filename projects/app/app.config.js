const isCodespaces = process.env.CODESPACES === "true";

const devApiUrl = isCodespaces
  ? "https://opulent-space-train-pjxwjr9qpvqv26xpx-3001.app.github.dev"
  : "http://localhost:3001";

const devSubscribeUrl = isCodespaces
  ? "https://opulent-space-train-pjxwjr9qpvqv26xpx-3000.app.github.dev/subscribe"
  : "http://localhost:3002/subscribe";

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
