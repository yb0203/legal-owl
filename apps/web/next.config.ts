import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. A stray root-level package-lock.json
  // otherwise makes Turbopack infer the repo root and resolve modules from the
  // wrong node_modules (breaks @swc/helpers resolution in dev).
  turbopack: { root: __dirname },
  // The agent definitions (lib/agents/defs/*.yaml) are read from disk at runtime
  // by the loader, so trace them into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./lib/agents/defs/**/*.yaml"],
  },
};

export default nextConfig;
