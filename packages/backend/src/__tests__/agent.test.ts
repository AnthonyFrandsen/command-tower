import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, describe, it } from "mocha";
import { Run } from "../models/Run.js";
import {
  buildClaudeArgs,
  formatStreamLine,
  getRunEmitter,
  spawnClaudeRun,
} from "../services/agent.js";

function makeMockChild(stdout: Readable, stderr: Readable) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: Readable;
    stderr: Readable;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  return proc;
}

describe("buildClaudeArgs", () => {
  it("includes --print flag", () => {
    assert.ok(buildClaudeArgs("hi").includes("--print"));
  });

  it("includes --dangerously-skip-permissions flag", () => {
    assert.ok(buildClaudeArgs("hi").includes("--dangerously-skip-permissions"));
  });

  it("includes --output-format stream-json and --verbose", () => {
    const args = buildClaudeArgs("hi");
    const idx = args.indexOf("--output-format");
    assert.ok(idx !== -1);
    assert.equal(args[idx + 1], "stream-json");
    assert.ok(args.includes("--verbose"));
  });

  it("passes -p and the prompt as the last two args", () => {
    const args = buildClaudeArgs("my prompt");
    const idx = args.indexOf("-p");
    assert.ok(idx !== -1);
    assert.equal(args[idx + 1], "my prompt");
  });
});

describe("formatStreamLine", () => {
  it("extracts text from an assistant event", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello there" }] },
    });
    assert.equal(formatStreamLine(line), "Hello there");
  });

  it("extracts tool name from a tool_use block", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "bash" }] },
    });
    assert.equal(formatStreamLine(line), "[bash]");
  });

  it("joins text and tool_use blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Running a command" },
          { type: "tool_use", name: "bash" },
        ],
      },
    });
    const result = formatStreamLine(line);
    assert.ok(result?.includes("Running a command"));
    assert.ok(result?.includes("[bash]"));
  });

  it("returns null for an assistant event with no content", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [] },
    });
    assert.equal(formatStreamLine(line), null);
  });

  it("returns the result text from a result event", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "The answer is 42",
      is_error: false,
    });
    assert.equal(formatStreamLine(line), "The answer is 42");
  });

  it("returns an error message for a failed result event", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "error",
      result: "something went wrong",
      is_error: true,
    });
    assert.ok(formatStreamLine(line)?.startsWith("Error:"));
  });

  it("returns null for system events", () => {
    const line = JSON.stringify({ type: "system", subtype: "init" });
    assert.equal(formatStreamLine(line), null);
  });

  it("returns null for user events", () => {
    const line = JSON.stringify({ type: "user", message: {} });
    assert.equal(formatStreamLine(line), null);
  });

  it("passes through non-JSON lines as-is", () => {
    assert.equal(formatStreamLine("plain text line"), "plain text line");
  });

  it("returns null for blank lines", () => {
    assert.equal(formatStreamLine("   "), null);
  });
});

describe("getRunEmitter", () => {
  it("returns undefined for an unknown runId", () => {
    assert.equal(getRunEmitter("nonexistent-id"), undefined);
  });
});

describe("spawnClaudeRun", () => {
  beforeEach(async () => {
    await Run.deleteMany({});
  });

  it("creates a Run document and returns a runId", async () => {
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    const child = makeMockChild(stdout, stderr);
    const mockSpawn = () => child as ReturnType<typeof import("node:child_process").spawn>;

    const runId = await spawnClaudeRun("test prompt", "/workspace", "test-key", mockSpawn);
    assert.ok(typeof runId === "string");

    const run = await Run.findOne({ runId }).lean();
    assert.ok(run);
    assert.equal(run.prompt, "test prompt");
    assert.equal(run.status, "running");

    child.emit("close", 0);
    await new Promise((r) => setTimeout(r, 50));
  });

  it("updates status to done when process exits with code 0", async () => {
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    const child = makeMockChild(stdout, stderr);
    const mockSpawn = () => child as ReturnType<typeof import("node:child_process").spawn>;

    const runId = await spawnClaudeRun("test prompt", "/workspace", "test-key", mockSpawn);
    const emitter = getRunEmitter(runId);
    assert.ok(emitter);

    await new Promise<void>((resolve) => {
      emitter.once("done", () => resolve());
      child.emit("close", 0);
    });

    const run = await Run.findOne({ runId }).lean();
    assert.ok(run);
    assert.equal(run.status, "done");
    assert.equal(run.exitCode, 0);
  });

  it("updates status to error when process exits with non-zero code", async () => {
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    const child = makeMockChild(stdout, stderr);
    const mockSpawn = () => child as ReturnType<typeof import("node:child_process").spawn>;

    const runId = await spawnClaudeRun("failing prompt", "/workspace", "test-key", mockSpawn);

    await new Promise<void>((resolve) => {
      getRunEmitter(runId)?.once("done", () => resolve());
      child.emit("close", 1);
    });

    const run = await Run.findOne({ runId }).lean();
    assert.equal(run?.status, "error");
  });

  it("parses and emits formatted text from NDJSON stdout", async () => {
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    const child = makeMockChild(stdout, stderr);
    const mockSpawn = () => child as ReturnType<typeof import("node:child_process").spawn>;

    const runId = await spawnClaudeRun("output test", "/workspace", "test-key", mockSpawn);

    const lines: string[] = [];
    getRunEmitter(runId)?.on("line", (line: string) => lines.push(line));

    const event = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello from agent" }] },
    });
    stdout.push(Buffer.from(`${event}\n`));
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(lines.some((l) => l.includes("Hello from agent")));

    child.emit("close", 0);
    await new Promise((r) => setTimeout(r, 20));
  });

  it("flushes an incomplete last line when the process closes", async () => {
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    const child = makeMockChild(stdout, stderr);
    const mockSpawn = () => child as ReturnType<typeof import("node:child_process").spawn>;

    const runId = await spawnClaudeRun("flush test", "/workspace", "test-key", mockSpawn);

    const lines: string[] = [];
    getRunEmitter(runId)?.on("line", (line: string) => lines.push(line));

    // Push a complete NDJSON event with no trailing newline so it stays buffered
    const event = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "partial line" }] },
    });
    stdout.push(Buffer.from(event)); // intentionally no \n
    // Wait one tick so the 'data' event fires before we emit 'close'
    await new Promise((r) => setImmediate(r));

    await new Promise<void>((resolve) => {
      getRunEmitter(runId)?.once("done", () => resolve());
      child.emit("close", 0);
    });

    assert.ok(lines.some((l) => l.includes("partial line")));
  });

  it("handles process error event", async () => {
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    const child = makeMockChild(stdout, stderr);
    const mockSpawn = () => child as ReturnType<typeof import("node:child_process").spawn>;

    const runId = await spawnClaudeRun("error test", "/workspace", "test-key", mockSpawn);

    await new Promise<void>((resolve) => {
      getRunEmitter(runId)?.once("done", () => resolve());
      child.emit("error", new Error("spawn ENOENT"));
    });

    const run = await Run.findOne({ runId }).lean();
    assert.equal(run?.status, "error");
    assert.ok(run?.output.includes("Process error"));
  });
});
