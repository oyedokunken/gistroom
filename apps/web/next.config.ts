import type { NextConfig } from "next";

const config: NextConfig = {
  // Browser tests build into their own folder so they never clash with a dev server that is already running.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@gistroom/shared", "@gistroom/db"],
  async redirects() {
    return [
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
