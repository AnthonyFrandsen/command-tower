module.exports = {
  spec: "src/__tests__/**/*.test.ts",
  require: ["tsx/cjs", "src/__tests__/hooks.ts"],
  timeout: 120000,
};
