import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles a minimal server (+ only the deps it uses) into
  // .next/standalone, so the production Docker image can run `node server.js`
  // without node_modules or dev tooling. Used by Dockerfile.prod.
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
