import "dotenv/config";

// Set FIRESTORE_EMULATOR_HOST if using emulator locally
// process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import { app } from "./app";

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
