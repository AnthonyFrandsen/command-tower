import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { loadConfig } from "../config.js";

const ENV_KEYS = ["PORT", "MONGODB_URI", "WORKSPACE_ROOT", "ANTHROPIC_API_KEY"] as const;
type EnvKey = (typeof ENV_KEYS)[number];

function saveEnv(): Partial<Record<EnvKey, string>> {
  const saved: Partial<Record<EnvKey, string>> = {};
  for (const k of ENV_KEYS) {
    if (process.env[k] !== undefined) saved[k] = process.env[k];
  }
  return saved;
}

function restoreEnv(saved: Partial<Record<EnvKey, string>>) {
  for (const k of ENV_KEYS) {
    if (k in saved) {
      process.env[k] = saved[k];
    } else {
      delete process.env[k];
    }
  }
}

describe("loadConfig", () => {
  it("returns config with defaults when optional env vars are absent", () => {
    const saved = saveEnv();
    for (const k of ENV_KEYS) delete process.env[k];
    try {
      const cfg = loadConfig();
      assert.equal(cfg.port, 3001);
      assert.ok(cfg.mongodbUri.includes("command-tower"));
      assert.ok(typeof cfg.workspaceRoot === "string");
      assert.equal(cfg.anthropicApiKey, null);
    } finally {
      restoreEnv(saved);
    }
  });

  it("reads PORT, MONGODB_URI, WORKSPACE_ROOT env vars", () => {
    const saved = saveEnv();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.PORT = "4000";
    process.env.MONGODB_URI = "mongodb://custom:27017/db";
    process.env.WORKSPACE_ROOT = "/custom/workspace";
    try {
      const cfg = loadConfig();
      assert.equal(cfg.port, 4000);
      assert.equal(cfg.mongodbUri, "mongodb://custom:27017/db");
      assert.equal(cfg.workspaceRoot, "/custom/workspace");
    } finally {
      restoreEnv(saved);
    }
  });

  it("reads ANTHROPIC_API_KEY when set", () => {
    const saved = saveEnv();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    try {
      const cfg = loadConfig();
      assert.equal(cfg.anthropicApiKey, "sk-ant-test-key");
    } finally {
      restoreEnv(saved);
    }
  });

  it("returns null for anthropicApiKey when ANTHROPIC_API_KEY is not set", () => {
    const saved = saveEnv();
    //biome-ignore lint: the variable can't just be undefined, it needs to have never been set
    delete process.env.VAR;
    try {
      const cfg = loadConfig();
      assert.equal(cfg.anthropicApiKey, null);
    } finally {
      restoreEnv(saved);
    }
  });
});
