import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    const apiServer = (process.env.API_SERVER_URL ?? "http://localhost:4000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${apiServer}/api/:path*` }];
  },
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
