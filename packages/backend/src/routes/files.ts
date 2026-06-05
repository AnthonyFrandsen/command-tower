import fs from "node:fs";
import { type Request, type Response, Router } from "express";
import type { Config } from "../config.js";
import {
  WorkspaceError,
  listDirectory,
  readTextFile,
  resolveWorkspacePath,
} from "../services/workspace.js";

export function createFilesRouter(config: Config): Router {
  const router = Router();

  router.get("/files", (req: Request, res: Response) => {
    const userPath = (req.query.path as string | undefined) ?? ".";

    let absPath: string;
    try {
      absPath = resolveWorkspacePath(config.workspaceRoot, userPath);
    } catch (err) {
      if (err instanceof WorkspaceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (!fs.existsSync(absPath)) {
      res.status(404).json({ error: "Path not found" });
      return;
    }

    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      try {
        const entries = listDirectory(absPath);
        const relBase = userPath === "." ? "" : userPath;
        const entriesWithRelPath = entries.map((e) => ({
          ...e,
          path: relBase ? `${relBase}/${e.name}` : e.name,
        }));
        res.json({ type: "directory", path: userPath, entries: entriesWithRelPath });
      } catch (err) {
        if (err instanceof WorkspaceError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        throw err;
      }
      return;
    }

    if (stat.isFile()) {
      try {
        const content = readTextFile(absPath);
        res.json({ type: "file", path: userPath, content });
      } catch (err) {
        if (err instanceof WorkspaceError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        throw err;
      }
      return;
    }

    res.status(400).json({ error: "Path is neither a file nor a directory" });
  });

  return router;
}
