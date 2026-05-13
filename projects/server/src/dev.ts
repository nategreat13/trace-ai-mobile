// Load `.env.local` first so it takes precedence over `.env`. We keep
// secrets like ANTHROPIC_API_KEY in `.env.local` because `.env` is
// loaded by `firebase deploy` at deploy time — and that fails if a
// value there shadows a runtime Secret declared via defineSecret() in
// index.ts. `.env.local` is gitignored AND ignored by firebase deploy,
// making it the right home for local-only secret overrides.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

// Set FIRESTORE_EMULATOR_HOST if using emulator locally
// process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as http from "node:http";
import { app } from "./app";
import { runWithEnv } from "./env";
import type { TraceEnv } from "@trace/shared";

const PORT = Number(process.env.PORT) || 3001;

// Local dev defaults to staging so a developer running `yarn dev2`
// against `yarn dev1` writes to `staging_*` collections instead of
// polluting prod data. Override with TRACE_ENV=prod if you specifically
// need to test against prod from the local server (rare — usually
// you'd just point the mobile app at the deployed prod API instead).
const ENV: TraceEnv = process.env.TRACE_ENV === "prod" ? "prod" : "staging";

// Same wrapper pattern as the deployed Cloud Function in index.ts:
// every incoming request runs inside `runWithEnv(ENV, ...)` so all
// `colRef(name)` calls inside the handler resolve to the right env.
const server = http.createServer((req, res) =>
  runWithEnv(ENV, () => app(req, res))
);

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on http://localhost:${PORT} (env: ${ENV.toUpperCase()})`
  );
});
