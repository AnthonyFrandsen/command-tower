import { type Request, type Response, Router } from "express";
import type { Config } from "../config.js";
import { Run } from "../models/Run.js";
import { getRunEmitter, spawnClaudeRun } from "../services/agent.js";

type SpawnFn = typeof spawnClaudeRun;

export function createRunsRouter(config: Config, spawnFn: SpawnFn = spawnClaudeRun): Router {
  const router = Router();

  // POST /api/runs — create a new run
  router.post("/runs", async (req: Request, res: Response) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const runId = await spawnFn(prompt.trim(), config.workspaceRoot, config.anthropicApiKey);
    res.status(202).json({ runId });
  });

  // GET /api/runs — list all runs newest-first
  router.get("/runs", async (_req: Request, res: Response) => {
    const runs = await Run.find({}, { __v: 0 }).sort({ startedAt: -1 }).lean();
    res.json({ runs });
  });

  // GET /api/runs/:id — full run detail
  router.get("/runs/:id", async (req: Request, res: Response) => {
    const run = await Run.findOne({ runId: req.params.id }, { __v: 0 }).lean();
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(run);
  });

  // GET /api/runs/:id/stream — SSE stream of run output
  router.get("/runs/:id/stream", async (req: Request, res: Response) => {
    const run = await Run.findOne({ runId: req.params.id }).lean();
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendLine = (text: string) => {
      const escaped = text.replace(/\n/g, "\ndata: ");
      res.write(`data: ${escaped}\n\n`);
    };

    const sendDone = () => {
      res.write("event: done\ndata: \n\n");
      res.end();
    };

    // If already finished, replay buffered output and close
    if (run.status === "done" || run.status === "error") {
      if (run.output) sendLine(run.output);
      sendDone();
      return;
    }

    const emitter = getRunEmitter(run.runId);
    if (!emitter) {
      if (run.output) sendLine(run.output);
      sendDone();
      return;
    }

    const onLine = (text: string) => sendLine(text);
    const onDone = () => {
      sendDone();
      cleanup();
    };

    const cleanup = () => {
      emitter.off("line", onLine);
      emitter.off("done", onDone);
    };

    emitter.on("line", onLine);
    emitter.on("done", onDone);

    req.on("close", cleanup);
  });

  // DELETE /api/runs/:id — delete a run record
  router.delete("/runs/:id", async (req: Request, res: Response) => {
    const result = await Run.deleteOne({ runId: req.params.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.status(204).send();
  });

  return router;
}
