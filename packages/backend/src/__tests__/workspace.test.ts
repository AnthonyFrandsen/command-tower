import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "mocha";
import {
  WorkspaceError,
  listDirectory,
  readTextFile,
  resolveWorkspacePath,
} from "../services/workspace.js";

describe("resolveWorkspacePath", () => {
  let root: string;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ct-ws-root-"));
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves a valid relative path", () => {
    const result = resolveWorkspacePath(root, "src/foo.ts");
    assert.equal(result, path.join(path.resolve(root), "src", "foo.ts"));
  });

  it("resolves a dot path to the root", () => {
    const result = resolveWorkspacePath(root, ".");
    assert.equal(result, path.resolve(root));
  });

  it("resolves correctly when root already ends with a separator", () => {
    const result = resolveWorkspacePath(root + path.sep, "README.md");
    assert.equal(result, path.join(path.resolve(root), "README.md"));
  });

  it("resolves a simple filename", () => {
    const result = resolveWorkspacePath(root, "README.md");
    assert.equal(result, path.join(path.resolve(root), "README.md"));
  });

  it("throws 400 for path traversal with ../", () => {
    assert.throws(
      () => resolveWorkspacePath(root, "../etc/passwd"),
      (err: unknown) => {
        assert(err instanceof WorkspaceError);
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });

  it("throws 400 for deeply nested traversal", () => {
    assert.throws(
      () => resolveWorkspacePath(root, "foo/../../etc/passwd"),
      (err: unknown) => {
        assert(err instanceof WorkspaceError);
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });

  it("throws 400 for absolute user path", () => {
    const absPath = process.platform === "win32" ? "C:\\Windows\\System32" : "/etc/passwd";
    assert.throws(
      () => resolveWorkspacePath(root, absPath),
      (err: unknown) => {
        assert(err instanceof WorkspaceError);
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });
});

describe("listDirectory", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-test-"));
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "hello");
    fs.mkdirSync(path.join(tmpDir, "subdir"));
    fs.writeFileSync(path.join(tmpDir, ".hidden"), "hidden");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists files and directories, excluding hidden files", () => {
    const entries = listDirectory(tmpDir);
    const names = entries.map((e) => e.name);
    assert.ok(names.includes("file.txt"));
    assert.ok(names.includes("subdir"));
    assert.ok(!names.includes(".hidden"));
  });

  it("sorts directories before files", () => {
    const entries = listDirectory(tmpDir);
    assert.equal(entries[0].name, "subdir");
    assert.equal(entries[0].type, "directory");
    assert.equal(entries[1].type, "file");
  });

  it("reports file size for files", () => {
    const entries = listDirectory(tmpDir);
    const file = entries.find((e) => e.name === "file.txt");
    assert.ok(file);
    assert.equal(file.size, 5);
  });

  it("reports null size for directories", () => {
    const entries = listDirectory(tmpDir);
    const dir = entries.find((e) => e.name === "subdir");
    assert.ok(dir);
    assert.equal(dir.size, null);
  });
});

describe("readTextFile", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-test-"));
    fs.writeFileSync(path.join(tmpDir, "text.txt"), "hello world");
    const buf = Buffer.from([0x68, 0x65, 0x6c, 0x6c, 0x00, 0x6f]);
    fs.writeFileSync(path.join(tmpDir, "binary.bin"), buf);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads a text file successfully", () => {
    const content = readTextFile(path.join(tmpDir, "text.txt"));
    assert.equal(content, "hello world");
  });

  it("throws 413 for files exceeding 1 MB", () => {
    const bigFile = path.join(tmpDir, "big.txt");
    fs.writeFileSync(bigFile, Buffer.alloc(1_048_577, 0x61)); // 1 MB + 1 byte
    assert.throws(
      () => readTextFile(bigFile),
      (err: unknown) => {
        assert(err instanceof WorkspaceError);
        assert.equal(err.statusCode, 413);
        return true;
      },
    );
  });

  it("throws 415 for binary files", () => {
    assert.throws(
      () => readTextFile(path.join(tmpDir, "binary.bin")),
      (err: unknown) => {
        assert(err instanceof WorkspaceError);
        assert.equal(err.statusCode, 415);
        return true;
      },
    );
  });
});
