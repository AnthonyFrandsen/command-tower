import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { beforeEach, describe, it } from "mocha";
import request from "supertest";
import { createApp } from "../app.js";
import type { Config } from "../config.js";
import { Run } from "../models/Run.js";
import { spawnClaudeRun } from "../services/agent.js";

const TEST_CONFIG: Config = {
  port: 3001,
  mongodbUri: "mongodb://localhost/test",
  workspaceRoot: "/workspace",
  anthropicApiKey: "test-key",
};

function sseGet(port: number, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => chunks.push(chunk));
      res.on("end", () => resolve(chunks.join("")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("SSE request timed out"));
    });
  });
}

describe("Run routes", () => {
  beforeEach(async () => {
    await Run.deleteMany({});
  });

  describe("POST /api/runs", () => {
    it("returns 400 when prompt is missing", async () => {
      const app = createApp(TEST_CONFIG);
      const res = await request(app).post("/api/runs").send({}).expect(400);
      assert.ok(res.body.error);
    });

    it("returns 400 when prompt is empty string", async () => {
      const app = createApp(TEST_CONFIG);
      const res = await request(app).post("/api/runs").send({ prompt: "   " }).expect(400);
      assert.ok(res.body.error);
    });

    it("returns 202 with runId for valid prompt using injected spawn", async () => {
      let capturedPrompt = "";
      const mockSpawn = async (prompt: string) => {
        capturedPrompt = prompt;
        return "mock-run-id-123";
      };
      const app = createApp(TEST_CONFIG, mockSpawn as Parameters<typeof createApp>[1]);
      const res = await request(app)
        .post("/api/runs")
        .send({ prompt: "Hello, agent!" })
        .expect(202);
      assert.equal(res.body.runId, "mock-run-id-123");
      assert.equal(capturedPrompt, "Hello, agent!");
    });
  });

  describe("GET /api/runs", () => {
    it("returns empty array when no runs exist", async () => {
      const app = createApp(TEST_CONFIG);
      const res = await request(app).get("/api/runs").expect(200);
      assert.ok(Array.isArray(res.body.runs));
      assert.equal(res.body.runs.length, 0);
    });

    it("returns runs sorted by startedAt descending", async () => {
      const now = new Date();
      await Run.create([
        {
          runId: "run-1",
          prompt: "First",
          status: "done",
          output: "",
          exitCode: 0,
          startedAt: new Date(now.getTime() - 10000),
          finishedAt: now,
          durationMs: 10000,
        },
        {
          runId: "run-2",
          prompt: "Second",
          status: "done",
          output: "",
          exitCode: 0,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
        },
      ]);

      const app = createApp(TEST_CONFIG);
      const res = await request(app).get("/api/runs").expect(200);
      assert.equal(res.body.runs[0].runId, "run-2");
      assert.equal(res.body.runs[1].runId, "run-1");
    });
  });

  describe("GET /api/runs/:id", () => {
    it("returns 404 for unknown run id", async () => {
      const app = createApp(TEST_CONFIG);
      const res = await request(app).get("/api/runs/nonexistent-id").expect(404);
      assert.ok(res.body.error);
    });

    it("returns run detail for existing run", async () => {
      await Run.create({
        runId: "detail-run-1",
        prompt: "Do something",
        status: "done",
        output: "result",
        exitCode: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 100,
      });

      const app = createApp(TEST_CONFIG);
      const res = await request(app).get("/api/runs/detail-run-1").expect(200);
      assert.equal(res.body.runId, "detail-run-1");
      assert.equal(res.body.prompt, "Do something");
      assert.equal(res.body.output, "result");
    });
  });

  describe("DELETE /api/runs/:id", () => {
    it("returns 404 for unknown run id", async () => {
      const app = createApp(TEST_CONFIG);
      await request(app).delete("/api/runs/nonexistent-id").expect(404);
    });

    it("deletes an existing run and returns 204", async () => {
      await Run.create({
        runId: "delete-run-1",
        prompt: "Delete me",
        status: "done",
        output: "",
        exitCode: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 0,
      });

      const app = createApp(TEST_CONFIG);
      await request(app).delete("/api/runs/delete-run-1").expect(204);
      const exists = await Run.exists({ runId: "delete-run-1" });
      assert.equal(exists, null);
    });
  });

  describe("GET /api/runs/:id/stream", () => {
    it("returns 404 for unknown run id", async () => {
      const app = createApp(TEST_CONFIG);
      const res = await request(app).get("/api/runs/nonexistent-stream-id/stream").expect(404);
      assert.ok(res.body.error);
    });

    it("streams buffered output and sends done event for a completed run", async () => {
      await Run.create({
        runId: "stream-done-1",
        prompt: "Done run",
        status: "done",
        output: "hello world output",
        exitCode: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 100,
      });

      const app = createApp(TEST_CONFIG);
      const server = http.createServer(app).listen(0);
      const port = (server.address() as AddressInfo).port;

      try {
        const body = await sseGet(port, "/api/runs/stream-done-1/stream");
        assert.ok(body.includes("hello world output"), "body should include output text");
        assert.ok(body.includes("event: done"), "body should include done event");
      } finally {
        server.close();
      }
    });

    it("streams live output to an SSE client from an active run", async () => {
      const stdout = new Readable({ read() {} });
      const stderr = new Readable({ read() {} });
      const proc = Object.assign(new EventEmitter(), { stdout, stderr });
      const mockChildSpawn = () => proc as ReturnType<typeof import("node:child_process").spawn>;

      const app = createApp(TEST_CONFIG, (prompt, workspaceRoot, apiKey) =>
        spawnClaudeRun(prompt, workspaceRoot, apiKey, mockChildSpawn),
      );

      const postRes = await request(app)
        .post("/api/runs")
        .send({ prompt: "live streaming test" })
        .expect(202);
      const { runId } = postRes.body as { runId: string };

      const server = http.createServer(app).listen(0);
      const port = (server.address() as AddressInfo).port;

      try {
        const ssePromise = sseGet(port, `/api/runs/${runId}/stream`);

        // Allow time for the SSE connection to be established
        await new Promise((r) => setTimeout(r, 50));

        // Push a formatted NDJSON line through stdout
        const event = JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "streamed hello" }] },
        });
        stdout.push(Buffer.from(`${event}\n`));
        await new Promise((r) => setTimeout(r, 20));

        // Close the process — triggers run completion and sends SSE done event
        proc.emit("close", 0);

        const body = await ssePromise;
        assert.ok(body.includes("streamed hello"), "body should include live output");
        assert.ok(body.includes("event: done"), "body should end with done event");
      } finally {
        server.close();
      }
    });

    it("replays partial output for a running run with no active emitter", async () => {
      await Run.create({
        runId: "stream-running-1",
        prompt: "Running run",
        status: "running",
        output: "partial output so far",
        exitCode: null,
        startedAt: new Date(),
        finishedAt: null,
        durationMs: null,
      });

      const app = createApp(TEST_CONFIG);
      const server = http.createServer(app).listen(0);
      const port = (server.address() as AddressInfo).port;

      try {
        const body = await sseGet(port, "/api/runs/stream-running-1/stream");
        assert.ok(body.includes("partial output so far"), "body should include partial output");
        assert.ok(body.includes("event: done"), "body should close with done event");
      } finally {
        server.close();
      }
    });
  });
});
