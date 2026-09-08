import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./src/testing/setup-integration.ts"],
    testTimeout: 15000,
    fileParallelism: false,
  },
});
