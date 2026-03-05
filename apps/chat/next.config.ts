import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@musait/shared", "@musait/tools"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveAlias: {
      "@musait/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@musait/tools": path.resolve(__dirname, "../../packages/tools/src/index.ts"),
    },
  },
};

export default nextConfig;
