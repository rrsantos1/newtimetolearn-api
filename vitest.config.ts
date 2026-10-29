import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup-env.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    fileParallelism: false,
  },
});