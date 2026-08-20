import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const encoreBase = process.env.ENCORE_API_BASE_URL || "http://localhost:4000";
    return [
      {
        // Proxy all /api/* routes to Encore so frontend calls can stay same-origin.
        source: "/api/:path*",
        destination: `${encoreBase}/api/:path*`,
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
