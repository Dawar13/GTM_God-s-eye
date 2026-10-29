import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Keep the dev-only indicator off the left rail's theme and collapse controls.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
