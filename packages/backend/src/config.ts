import "dotenv/config";

export interface Config {
  port: number;
  mongodbUri: string;
  workspaceRoot: string;
  // null when authenticating via Claude OAuth credentials instead of API key
  anthropicApiKey: string | null;
}

export function loadConfig(): Config {
  return {
    port: Number.parseInt(process.env.PORT ?? "3001", 10),
    mongodbUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/command-tower",
    workspaceRoot: process.env.WORKSPACE_ROOT ?? process.cwd(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
  };
}
