import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { useTypeScriptCli: false, workerThreads: true, cpus: 2 },
};
export default config;
