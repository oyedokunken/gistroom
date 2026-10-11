import type { MetadataRoute } from "next";
import { site } from "@/content/site";

/** Public pages open to search, the signed in app closed (Section 12.2). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app",
          "/api",
          "/onboarding",
          "/password",
          "/interests",
          "/verify",
          "/forgot",
          "/offline",
          "/dev",
        ],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
