import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "mocha";
import request from "supertest";
import { createApp } from "../app.js";
import type { Config } from "../config.js";

function makeConfig(workspaceRoot: string): Config {
  return {
    port: 3001,
    mongodbUri: "mongodb://localhost/test",
    workspaceRoot,
    anthropicApiKey: "test-key",
  };
}

describe("GET /api/files", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-files-test-"));
    fs.writeFileSync(path.join(tmpDir, "hello.txt"), "Hello, world!");
    fs.mkdirSync(path.join(tmpDir, "src"));
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export {};");
    // binary file: contains a null byte
    fs.writeFileSync(path.join(tmpDir, "binary.bin"), Buffer.from([0x68, 0x65, 0x00, 0x6c, 0x6f]));
    // oversized file: 1 MB + 1 byte
    fs.writeFileSync(path.join(tmpDir, "huge.txt"), Buffer.alloc(1_048_577, 0x61));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns directory listing for root", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files").expect(200);
    assert.equal(res.body.type, "directory");
    assert.ok(Array.isArray(res.body.entries));
    const names = res.body.entries.map((e: { name: string }) => e.name);
    assert.ok(names.includes("hello.txt"));
    assert.ok(names.includes("src"));
  });

  it("returns directory listing for a subdirectory", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files?path=src").expect(200);
    assert.equal(res.body.type, "directory");
    const names = res.body.entries.map((e: { name: string }) => e.name);
    assert.ok(names.includes("index.ts"));
  });

  it("returns file content for a text file", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files?path=hello.txt").expect(200);
    assert.equal(res.body.type, "file");
    assert.equal(res.body.content, "Hello, world!");
  });

  it("returns 400 for path traversal attempts", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files?path=../etc/passwd").expect(400);
    assert.ok(res.body.error);
  });

  it("returns 400 for absolute path", async () => {
    const app = createApp(makeConfig(tmpDir));
    const absPath = process.platform === "win32" ? "C:\\Windows\\System32" : "/etc/passwd";
    const res = await request(app)
      .get(`/api/files?path=${encodeURIComponent(absPath)}`)
      .expect(400);
    assert.ok(res.body.error);
  });

  it("returns 404 for non-existent path", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files?path=nonexistent.txt").expect(404);
    assert.ok(res.body.error);
  });

  it("returns 413 for a file exceeding 1 MB", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files?path=huge.txt").expect(413);
    assert.ok(res.body.error);
  });

  it("returns 415 for a binary file", async () => {
    const app = createApp(makeConfig(tmpDir));
    const res = await request(app).get("/api/files?path=binary.bin").expect(415);
    assert.ok(res.body.error);
  });
});
