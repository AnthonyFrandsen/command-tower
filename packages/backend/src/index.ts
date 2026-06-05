import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { connectDb } from "./db.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await connectDb(config.mongodbUri);
  console.log("Connected to MongoDB");

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Backend listening on port ${config.port}`);
    console.log(`Workspace root: ${config.workspaceRoot}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
