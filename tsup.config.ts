import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "wa-gateway/index": "src/wa-gateway/index.ts",
    "jobs/run-jobs": "src/jobs/run-jobs.ts",
  },
  tsconfig: "tsconfig.workers.json",
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  bundle: true,
});
