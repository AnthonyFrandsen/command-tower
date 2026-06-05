export type RunStatus = "pending" | "running" | "done" | "error";

export interface Run {
  _id: string;
  runId: string;
  prompt: string;
  status: RunStatus;
  output: string;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface RunSummary {
  runId: string;
  prompt: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
}

export interface DirectoryResult {
  type: "directory";
  path: string;
  entries: FileEntry[];
}

export interface FileResult {
  type: "file";
  path: string;
  content: string;
}

export type FileApiResult = DirectoryResult | FileResult;
