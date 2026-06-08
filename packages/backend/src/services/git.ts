import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorkspaceError, resolveWorkspacePath } from "./workspace.js";

const execFileAsync = promisify(execFile);

const MAX_DIFF_BYTES = 100 * 1024;
const TRUNCATION_SENTINEL =
  "\\ Diff truncated at 100 KB. Run `git diff HEAD` locally for the full output.";

export interface FileStatus {
  path: string;
  status: "M" | "A" | "D" | "R" | "?";
}

export interface GitStatusResult {
  isGitRepo: boolean;
  files: FileStatus[];
}

export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: "not_a_git_repository" | "no_commits",
  ) {
    super(message);
    this.name = "GitError";
  }
}

export async function getGitStatus(workspaceRoot: string): Promise<GitStatusResult> {
  try {
    await execFileAsync("git", ["-C", workspaceRoot, "rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { isGitRepo: false, files: [] };
  }

  const { stdout } = await execFileAsync("git", [
    "-C",
    workspaceRoot,
    "status",
    "--porcelain",
  ]);

  const files: FileStatus[] = [];
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    const x = line[0];
    const y = line[1];
    const pathPart = line.slice(3);
    const filePath = pathPart.includes(" -> ") ? pathPart.split(" -> ")[1] : pathPart;

    const code = y !== " " && y !== "!" ? y : x;

    let status: FileStatus["status"];
    if (code === "M") status = "M";
    else if (code === "A") status = "A";
    else if (code === "D") status = "D";
    else if (code === "R") status = "R";
    else if (code === "?") status = "?";
    else continue;

    files.push({ path: filePath, status });
  }

  return { isGitRepo: true, files };
}

export async function getGitDiff(workspaceRoot: string, filePath?: string): Promise<string> {
  if (filePath) {
    resolveWorkspacePath(workspaceRoot, filePath);
  }

  try {
    await execFileAsync("git", ["-C", workspaceRoot, "rev-parse", "--is-inside-work-tree"]);
  } catch {
    throw new GitError("not a git repository", "not_a_git_repository");
  }

  try {
    await execFileAsync("git", ["-C", workspaceRoot, "rev-parse", "HEAD"]);
  } catch {
    throw new GitError("no commits yet", "no_commits");
  }

  const args = ["-C", workspaceRoot, "diff", "HEAD", ...(filePath ? ["--", filePath] : [])];

  let stdout: string;
  try {
    const result = await execFileAsync("git", args, {
      maxBuffer: 110 * 1024,
      encoding: "utf8",
    });
    stdout = result.stdout;
  } catch (err) {
    const error = err as { code?: string; stdout?: string };
    if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      const partial = error.stdout ?? "";
      return partial.slice(0, MAX_DIFF_BYTES) + "\n" + TRUNCATION_SENTINEL;
    }
    throw err;
  }

  const buf = Buffer.from(stdout, "utf-8");
  if (buf.length > MAX_DIFF_BYTES) {
    return buf.slice(0, MAX_DIFF_BYTES).toString("utf-8") + "\n" + TRUNCATION_SENTINEL;
  }

  return stdout;
}
