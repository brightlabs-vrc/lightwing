import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const encoreBase = process.env.ENCORE_API_BASE_URL || "http://localhost:4000";
    return [
      {
        // Proxy /api/auth/* to Encore so session cookies are first-party.
        // The :path* in destination captures the matched path parameter.
        source: "/api/auth/:path*",
        destination: `${encoreBase}/api/auth/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.discord.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
