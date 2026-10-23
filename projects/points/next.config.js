const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a production build run without clobbering a running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Workspace package with the env-aware Firestore collection names.
  transpilePackages: ["@trace/shared"],
  // Monorepo: trace server files from the repo root so hoisted packages ship with the functions.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

module.exports = nextConfig;
