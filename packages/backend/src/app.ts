import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Config } from "./config.js";
import { loadConfig } from "./config.js";
import { createFilesRouter } from "./routes/files.js";
import healthRouter from "./routes/health.js";
import { createRunsRouter } from "./routes/runs.js";
import type { spawnClaudeRun } from "./services/agent.js";

type SpawnFn = typeof spawnClaudeRun;

export function createApp(config?: Config, spawnFn?: SpawnFn): express.Application {
  const cfg = config ?? loadConfig();
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api", createFilesRouter(cfg));
  app.use("/api", createRunsRouter(cfg, spawnFn));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
