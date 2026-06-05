import type { FileApiResult, Run, RunSummary } from "./types.js";

const BASE = "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function getFiles(path?: string): Promise<FileApiResult> {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  return apiFetch<FileApiResult>(`/api/files${query}`);
}

export async function createRun(prompt: string): Promise<{ runId: string }> {
  return apiFetch<{ runId: string }>("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

export async function listRuns(): Promise<{ runs: RunSummary[] }> {
  return apiFetch<{ runs: RunSummary[] }>("/api/runs");
}

export async function getRun(runId: string): Promise<Run> {
  return apiFetch<Run>(`/api/runs/${runId}`);
}

export async function deleteRun(runId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/runs/${runId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete run: ${res.statusText}`);
  }
}

export function streamRun(
  runId: string,
  onLine: (line: string) => void,
  onDone: () => void,
): () => void {
  const es = new EventSource(`/api/runs/${runId}/stream`);

  es.onmessage = (event) => {
    if (event.data) onLine(event.data as string);
  };

  es.addEventListener("done", () => {
    onDone();
    es.close();
  });

  es.onerror = () => {
    onDone();
    es.close();
  };

  return () => es.close();
}
