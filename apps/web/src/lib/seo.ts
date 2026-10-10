import type { Metadata } from "next";
import { site } from "@/content/site";

/**
 * Metadata for a public page (Section 12.2). The root layout adds "| Gistroom" to the title,
 * so pass just the page name. Descriptions stay under 160 characters.
 */
export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const url = `${site.url}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_NG",
      url,
      title: `${input.title} | ${site.name}`,
      description: input.description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${input.title} | ${site.name}`,
      description: input.description,
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
