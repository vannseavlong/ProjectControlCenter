import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pcc/ui", "@pcc/db", "@pcc/types"],
};

export default nextConfig;
