import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { Run } from "../models/Run.js";

const emitters = new Map<string, EventEmitter>();

export function getRunEmitter(runId: string): EventEmitter | undefined {
  return emitters.get(runId);
}

export function buildClaudeArgs(prompt: string): string[] {
  return [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
    "-p",
    prompt,
  ];
}

// ── stream-json event types ──────────────────────────────────────────────────

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  name: string;
}

type ContentBlock = TextBlock | ToolUseBlock | { type: string };

interface AssistantEvent {
  type: "assistant";
  message: { content: ContentBlock[] };
}

interface ResultEvent {
  type: "result";
  subtype: string;
  result: string | null;
  is_error: boolean;
}

type StreamEvent = AssistantEvent | ResultEvent | { type: string };

/**
 * Parses one NDJSON line from `--output-format stream-json` and returns
 * the human-readable text to display, or null to skip the line entirely.
 */
export function formatStreamLine(line: string): string | null {
  let event: StreamEvent;
  try {
    event = JSON.parse(line) as StreamEvent;
  } catch {
    // Not JSON (shouldn't happen with stream-json) — pass through as-is.
    return line.trim() || null;
  }

  if (event.type === "assistant") {
    const { message } = event as AssistantEvent;
    const parts: string[] = [];
    for (const block of message.content) {
      if (block.type === "text") {
        const text = (block as TextBlock).text.trim();
        if (text) parts.push(text);
      } else if (block.type === "tool_use") {
        parts.push(`[${(block as ToolUseBlock).name}]`);
      }
    }
    return parts.length ? parts.join("\n") : null;
  }

  if (event.type === "result") {
    const { result, is_error } = event as ResultEvent;
    if (is_error) return `Error: ${result ?? "unknown error"}`;
    return result ?? null;
  }

  // Skip system, user, tool_result, and other internal bookkeeping events.
  return null;
}

// ── spawn ────────────────────────────────────────────────────────────────────

type SpawnFn = (cmd: string, args: string[], opts: SpawnOptions) => ChildProcess;

export async function spawnClaudeRun(
  prompt: string,
  workspaceRoot: string,
  apiKey: string | null,
  spawnFn: SpawnFn = spawn,
): Promise<string> {
  const runId = uuidv4();
  const startedAt = new Date();

  await Run.create({
    runId,
    prompt,
    status: "pending",
    output: "",
    exitCode: null,
    startedAt,
    finishedAt: null,
    durationMs: null,
  });

  const emitter = new EventEmitter();
  emitters.set(runId, emitter);

  const args = buildClaudeArgs(prompt);
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (apiKey) env.ANTHROPIC_API_KEY = apiKey;
  // The backend container runs NODE_ENV=production, but npm respects that by
  // omitting devDependencies during installs. Workspace commands need the full
  // dep tree (tsc, vite, biome, etc. are devDeps), so clear it for the agent.
  //biome-ignore lint: can't be undefined, must be unset.
  delete env.NODE_ENV;

  const child = spawnFn("claude", args, {
    cwd: workspaceRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  await Run.updateOne({ runId }, { $set: { status: "running" } });

  let accumulated = "";
  let lineBuffer = "";

  const processLine = (line: string): string | null => {
    if (!line.trim()) return null;
    return formatStreamLine(line);
  };

  const onData = async (chunk: Buffer) => {
    lineBuffer += chunk.toString("utf-8");
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";

    let newText = "";
    for (const line of lines) {
      const formatted = processLine(line);
      if (formatted !== null) newText += `${formatted}\n`;
    }

    if (newText) {
      accumulated += newText;
      emitter.emit("line", newText);
      await Run.updateOne({ runId }, { $set: { output: accumulated } });
    }
  };

  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  child.on("close", async (code) => {
    // Flush any incomplete last line
    if (lineBuffer.trim()) {
      const formatted = processLine(lineBuffer);
      if (formatted) {
        accumulated += `${formatted}\n`;
        emitter.emit("line", `${formatted}\n`);
      }
      lineBuffer = "";
    }

    const exitCode = code ?? 1;
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const status = exitCode === 0 ? "done" : "error";

    await Run.updateOne(
      { runId },
      { $set: { status, exitCode, finishedAt, durationMs, output: accumulated } },
    );

    emitter.emit("done", exitCode);
    emitters.delete(runId);
  });

  child.on("error", async (err) => {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const errorOutput = `\n[Process error: ${err.message}]`;
    accumulated += errorOutput;

    await Run.updateOne(
      { runId },
      { $set: { status: "error", exitCode: -1, finishedAt, durationMs, output: accumulated } },
    );

    emitter.emit("line", errorOutput);
    emitter.emit("done", -1);
    emitters.delete(runId);
  });

  return runId;
}
