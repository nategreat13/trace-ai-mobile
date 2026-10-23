/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a production build run without clobbering a running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

module.exports = nextConfig;
