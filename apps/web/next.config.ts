import type { NextConfig } from "next";

const config: NextConfig = {
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
