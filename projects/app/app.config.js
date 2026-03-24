const isCodespaces = process.env.CODESPACES === "true";

const devApiUrl = isCodespaces
  ? "https://opulent-space-train-pjxwjr9qpvqv26xpx-3001.app.github.dev"
  : "http://localhost:3001";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    devApiUrl,
  },
});
