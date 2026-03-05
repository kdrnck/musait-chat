import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@musait/shared", "@musait/tools"],
};

export default nextConfig;
