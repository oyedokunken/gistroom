import type { MetadataRoute } from "next";
import { TOPICS } from "@gistroom/shared";
import { site } from "@/content/site";
import { listPublicRooms } from "@/server/rooms/public";

const STATIC = [
  "",
  "/features",
  "/rooms",
  "/safety",
  "/security",
  "/about",
  "/support",
  "/install",
  "/changelog",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/login",
  "/signup",
];

/** Static pages, topic pages and scheduled public Rooms (Section 12.2). Live rooms change too fast to list. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { rooms } = await listPublicRooms();
  return [
    ...STATIC.map((p) => ({
      url: `${site.url}${p}`,
      lastModified: now,
      changeFrequency: p === "" || p === "/rooms" ? ("daily" as const) : ("monthly" as const),
      priority: p === "" ? 1 : p === "/rooms" ? 0.9 : 0.6,
    })),
    ...TOPICS.map((t) => ({
      url: `${site.url}/topics/${t.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...rooms
      .filter((r) => r.status === "SCHEDULED")
      .map((r) => ({
        url: `${site.url}/rooms/${r.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.5,
      })),
  ];
}
