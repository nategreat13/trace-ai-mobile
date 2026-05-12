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

import { app } from "./app";

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
