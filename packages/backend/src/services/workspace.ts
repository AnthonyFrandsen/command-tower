import fs from "node:fs";
import path from "node:path";

const MAX_FILE_BYTES = 1_048_576; // 1 MB

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
}

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export function resolveWorkspacePath(root: string, userPath: string): string {
  if (path.isAbsolute(userPath)) {
    throw new WorkspaceError("Absolute paths are not allowed", 400);
  }
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, path.normalize(userPath));
  // Ensure the resolved path is within the root (directory traversal guard)
  const rootWithSep = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : normalizedRoot + path.sep;
  if (resolved !== normalizedRoot && !resolved.startsWith(rootWithSep)) {
    throw new WorkspaceError("Path traversal is not allowed", 400);
  }
  return resolved;
}

export function listDirectory(absPath: string): FileEntry[] {
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => {
      const isDir = e.isDirectory();
      let size: number | null = null;
      if (!isDir) {
        try {
          size = fs.statSync(path.join(absPath, e.name)).size;
        } catch {
          size = null;
        }
      }
      return {
        name: e.name,
        path: e.name,
        type: isDir ? ("directory" as const) : ("file" as const),
        size,
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function readTextFile(absPath: string): string {
  const stat = fs.statSync(absPath);
  if (stat.size > MAX_FILE_BYTES) {
    throw new WorkspaceError(`File exceeds maximum readable size of ${MAX_FILE_BYTES} bytes`, 413);
  }
  const buf = fs.readFileSync(absPath);
  // Reject binary files by checking for null bytes
  if (buf.includes(0)) {
    throw new WorkspaceError("Binary files cannot be displayed", 415);
  }
  return buf.toString("utf-8");
}
