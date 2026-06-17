import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "mocha";
import request from "supertest";
import { createApp } from "../app.js";
import type { Config } from "../config.js";
import { GitError, getGitDiff, getGitStatus } from "../services/git.js";
import { WorkspaceError } from "../services/workspace.js";

function makeConfig(workspaceRoot: string): Config {
  return {
    port: 3001,
    mongodbUri: "mongodb://localhost/test",
    workspaceRoot,
    anthropicApiKey: "test-key",
  };
}

function gitInit(dir: string) {
  execFileSync("git", ["-C", dir, "init"]);
  execFileSync("git", ["-C", dir, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "Test"]);
}

function gitCommit(dir: string, message: string) {
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "commit", "-m", message]);
}

// ── getGitStatus ──────────────────────────────────────────────────────────────

describe("getGitStatus", () => {
  let nonGitDir: string;
  let repoDir: string;

  before(() => {
    nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-git-non-"));
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-git-repo-"));
    gitInit(repoDir);
    fs.writeFileSync(path.join(repoDir, "initial.txt"), "hello");
    gitCommit(repoDir, "initial commit");
  });

  after(() => {
    fs.rmSync(nonGitDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it("returns isGitRepo: false for a non-git directory", async () => {
    const result = await getGitStatus(nonGitDir);
    assert.equal(result.isGitRepo, false);
    assert.deepEqual(result.files, []);
  });

  it("returns isGitRepo: true for a git repo", async () => {
    const result = await getGitStatus(repoDir);
    assert.equal(result.isGitRepo, true);
    assert.ok(Array.isArray(result.files));
  });

  it("reports modified tracked files with status M", async () => {
    fs.writeFileSync(path.join(repoDir, "initial.txt"), "modified");
    const result = await getGitStatus(repoDir);
    const modified = result.files.find((f) => f.path === "initial.txt");
    assert.ok(modified);
    assert.equal(modified.status, "M");
    // restore
    fs.writeFileSync(path.join(repoDir, "initial.txt"), "hello");
  });

  it("excludes modified files where only line endings differ", async () => {
    const crlfFile = path.join(repoDir, "crlf_test.txt");
    fs.writeFileSync(crlfFile, "line1\nline2\n");
    gitCommit(repoDir, "add crlf_test file");

    // Change LF → CRLF (content identical, only line endings differ)
    fs.writeFileSync(crlfFile, "line1\r\nline2\r\n");
    const result = await getGitStatus(repoDir);
    const found = result.files.find((f) => f.path === "crlf_test.txt");
    assert.equal(found, undefined, "CRLF-only change should not appear in status");

    // Restore to committed state
    execFileSync("git", ["-C", repoDir, "checkout", "--", "crlf_test.txt"]);
  });

  it("still reports modified files with real content changes alongside line-ending noise", async () => {
    const mixedFile = path.join(repoDir, "mixed_test.txt");
    fs.writeFileSync(mixedFile, "alpha\nbeta\n");
    gitCommit(repoDir, "add mixed_test file");

    // Change content AND line endings
    fs.writeFileSync(mixedFile, "alpha\r\nchanged\r\n");
    const result = await getGitStatus(repoDir);
    const found = result.files.find((f) => f.path === "mixed_test.txt");
    assert.ok(found, "file with real content changes should still appear");
    assert.equal(found.status, "M");

    execFileSync("git", ["-C", repoDir, "checkout", "--", "mixed_test.txt"]);
  });

  it("reports untracked files with status ?", async () => {
    fs.writeFileSync(path.join(repoDir, "untracked.txt"), "new");
    const result = await getGitStatus(repoDir);
    const untracked = result.files.find((f) => f.path === "untracked.txt");
    assert.ok(untracked);
    assert.equal(untracked.status, "?");
    // clean up
    fs.rmSync(path.join(repoDir, "untracked.txt"));
  });

  it("returns empty files array for a clean working tree", async () => {
    const result = await getGitStatus(repoDir);
    assert.equal(result.files.length, 0);
  });
});

// ── getGitDiff ────────────────────────────────────────────────────────────────

describe("getGitDiff", () => {
  let nonGitDir: string;
  let emptyRepoDir: string;
  let repoDir: string;

  before(() => {
    nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-diff-non-"));

    emptyRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-diff-empty-"));
    gitInit(emptyRepoDir);
    fs.writeFileSync(path.join(emptyRepoDir, "file.txt"), "untracked");

    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-diff-repo-"));
    gitInit(repoDir);
    fs.writeFileSync(path.join(repoDir, "file.txt"), "original");
    gitCommit(repoDir, "initial commit");
  });

  after(() => {
    fs.rmSync(nonGitDir, { recursive: true, force: true });
    fs.rmSync(emptyRepoDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it("throws GitError not_a_git_repository for non-git dir", async () => {
    await assert.rejects(
      () => getGitDiff(nonGitDir),
      (err: unknown) => {
        assert(err instanceof GitError);
        assert.equal(err.code, "not_a_git_repository");
        return true;
      },
    );
  });

  it("throws GitError no_commits for repo with no commits", async () => {
    await assert.rejects(
      () => getGitDiff(emptyRepoDir),
      (err: unknown) => {
        assert(err instanceof GitError);
        assert.equal(err.code, "no_commits");
        return true;
      },
    );
  });

  it("returns empty string for clean working tree", async () => {
    const result = await getGitDiff(repoDir);
    assert.equal(result, "");
  });

  it("returns diff string when files are modified", async () => {
    fs.writeFileSync(path.join(repoDir, "file.txt"), "modified content");
    const result = await getGitDiff(repoDir);
    assert.ok(result.includes("diff --git"));
    assert.ok(result.includes("+modified content"));
    // restore
    fs.writeFileSync(path.join(repoDir, "file.txt"), "original");
  });

  it("returns diff for a specific file", async () => {
    fs.writeFileSync(path.join(repoDir, "file.txt"), "changed");
    const result = await getGitDiff(repoDir, "file.txt");
    assert.ok(result.includes("diff --git"));
    // restore
    fs.writeFileSync(path.join(repoDir, "file.txt"), "original");
  });

  it("returns empty diff when the only change is line endings", async () => {
    const crlfFile = path.join(repoDir, "crlf_diff.txt");
    fs.writeFileSync(crlfFile, "hello\nworld\n");
    execFileSync("git", ["-C", repoDir, "add", "crlf_diff.txt"]);
    execFileSync("git", ["-C", repoDir, "commit", "-m", "add crlf_diff file"]);

    fs.writeFileSync(crlfFile, "hello\r\nworld\r\n");
    const result = await getGitDiff(repoDir, "crlf_diff.txt");
    assert.equal(result, "", "diff should be empty when only line endings changed");

    execFileSync("git", ["-C", repoDir, "checkout", "--", "crlf_diff.txt"]);
  });

  it("throws WorkspaceError for path traversal", async () => {
    await assert.rejects(
      () => getGitDiff(repoDir, "../etc/passwd"),
      (err: unknown) => {
        assert(err instanceof WorkspaceError);
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });
});

// ── GET /api/git/status ───────────────────────────────────────────────────────

describe("GET /api/git/status", () => {
  let nonGitDir: string;
  let repoDir: string;

  before(() => {
    nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-route-status-non-"));
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-route-status-repo-"));
    gitInit(repoDir);
    fs.writeFileSync(path.join(repoDir, "a.txt"), "hello");
    gitCommit(repoDir, "init");
  });

  after(() => {
    fs.rmSync(nonGitDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it("returns 200 with isGitRepo: false for non-git dir", async () => {
    const app = createApp(makeConfig(nonGitDir));
    const res = await request(app).get("/api/git/status").expect(200);
    assert.equal(res.body.isGitRepo, false);
  });

  it("returns 200 with isGitRepo: true for a git repo", async () => {
    const app = createApp(makeConfig(repoDir));
    const res = await request(app).get("/api/git/status").expect(200);
    assert.equal(res.body.isGitRepo, true);
    assert.ok(Array.isArray(res.body.files));
  });

  it("includes changed files in the response", async () => {
    fs.writeFileSync(path.join(repoDir, "new.txt"), "added");
    const app = createApp(makeConfig(repoDir));
    const res = await request(app).get("/api/git/status").expect(200);
    const paths = (res.body.files as Array<{ path: string }>).map((f) => f.path);
    assert.ok(paths.includes("new.txt"));
    fs.rmSync(path.join(repoDir, "new.txt"));
  });
});

// ── GET /api/git/diff ─────────────────────────────────────────────────────────

describe("GET /api/git/diff", () => {
  let nonGitDir: string;
  let emptyRepoDir: string;
  let repoDir: string;

  before(() => {
    nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-route-diff-non-"));

    emptyRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-route-diff-empty-"));
    gitInit(emptyRepoDir);

    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "ct-route-diff-repo-"));
    gitInit(repoDir);
    fs.writeFileSync(path.join(repoDir, "main.txt"), "original");
    gitCommit(repoDir, "initial");
  });

  after(() => {
    fs.rmSync(nonGitDir, { recursive: true, force: true });
    fs.rmSync(emptyRepoDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it("returns 404 for non-git workspace", async () => {
    const app = createApp(makeConfig(nonGitDir));
    const res = await request(app).get("/api/git/diff").expect(404);
    assert.ok(res.body.error);
  });

  it("returns 422 for repo with no commits", async () => {
    const app = createApp(makeConfig(emptyRepoDir));
    const res = await request(app).get("/api/git/diff").expect(422);
    assert.ok(res.body.error);
  });

  it("returns 200 with empty diff for clean working tree", async () => {
    const app = createApp(makeConfig(repoDir));
    const res = await request(app).get("/api/git/diff").expect(200);
    assert.equal(res.body.diff, "");
  });

  it("returns 200 with diff content when files are changed", async () => {
    fs.writeFileSync(path.join(repoDir, "main.txt"), "changed content");
    const app = createApp(makeConfig(repoDir));
    const res = await request(app).get("/api/git/diff").expect(200);
    assert.ok(typeof res.body.diff === "string");
    assert.ok(res.body.diff.includes("diff --git"));
    // restore
    fs.writeFileSync(path.join(repoDir, "main.txt"), "original");
  });

  it("returns 200 with single-file diff when path is provided", async () => {
    fs.writeFileSync(path.join(repoDir, "main.txt"), "single file change");
    const app = createApp(makeConfig(repoDir));
    const res = await request(app).get("/api/git/diff?path=main.txt").expect(200);
    assert.ok(res.body.diff.includes("main.txt"));
    // restore
    fs.writeFileSync(path.join(repoDir, "main.txt"), "original");
  });

  it("returns 400 for path traversal attempt", async () => {
    const app = createApp(makeConfig(repoDir));
    const res = await request(app).get("/api/git/diff?path=../etc/passwd").expect(400);
    assert.ok(res.body.error);
  });
});
