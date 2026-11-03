import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  // Browser tests build into their own folder so they never clash with a dev server that is already running.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@gistroom/shared", "@gistroom/db"],
  async redirects() {
    return [
      {
        // The old Vercel address sends people to the real domain. API routes stay put so cron, webhooks and
        // callbacks that still point here keep working. Previews live on other hosts and are not touched.
        source: "/:path((?!api(?:/|$)).*)",
        has: [{ type: "host", value: "gistroom.vercel.app" }],
        destination: "https://gistroom.oyedokun.dev/:path",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.gistroom.ng" }],
        destination: "https://gistroom.ng/:path*",
        permanent: true,
      },
    ];
  },
};

export default config;
