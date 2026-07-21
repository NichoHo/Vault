import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // same-origin proxy for the IdP so its session cookie needs no CORS games in dev
    return [
      {
        source: "/idp/:path*",
        destination: `${process.env.ID_URL ?? "http://localhost:8081"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
