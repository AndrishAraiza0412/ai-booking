import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname, // there is another package-lock.json in the home folder
};

export default nextConfig;
