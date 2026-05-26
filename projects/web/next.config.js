/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace package — must be transpiled by Next because it's distributed
  // as TS source via `dist/`. Adding it here ensures any ESM/CJS quirks
  // are handled consistently across server + client components.
  transpilePackages: ["@trace/shared"],
};

module.exports = nextConfig;
