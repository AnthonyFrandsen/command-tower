import { type NextFunction, type Request, type Response, Router } from "express";
import type { Config } from "../config.js";
import { GitError, getGitDiff, getGitStatus } from "../services/git.js";
import { WorkspaceError } from "../services/workspace.js";

export function createGitRouter(config: Config): Router {
  const router = Router();

  router.get("/git/status", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getGitStatus(config.workspaceRoot);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/git/diff", async (req: Request, res: Response, next: NextFunction) => {
    const filePath = req.query.path as string | undefined;

    try {
      const diff = await getGitDiff(config.workspaceRoot, filePath);
      res.json({ diff });
    } catch (err) {
      if (err instanceof WorkspaceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (err instanceof GitError) {
        if (err.code === "not_a_git_repository") {
          res.status(404).json({ error: "Not a git repository" });
          return;
        }
        if (err.code === "no_commits") {
          res.status(422).json({ error: "No commits yet" });
          return;
        }
      }
      next(err);
    }
  });

  return router;
}
