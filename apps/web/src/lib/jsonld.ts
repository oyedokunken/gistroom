import { site } from "@/content/site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/icon-512.png`,
    creator: { "@type": "Person", name: "oyedokunken", url: "https://www.oyedokun.dev/" },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    inLanguage: "en-NG",
  };
}

/** Serialise for an inline script tag. Escapes the less-than sign so content cannot close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, String.fromCharCode(92) + "u003c");
}

export function breadcrumbJsonLd(trail: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${site.url}${t.path}`,
    })),
  };
}

export function faqJsonLd(items: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}

export function softwareAppJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web, Android, iOS, Windows, macOS",
    url: site.url,
    description: site.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
  };
}

export function eventJsonLd(input: {
  name: string;
  description: string | null;
  startDate: Date;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.name,
    description: input.description ?? undefined,
    startDate: input.startDate.toISOString(),
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "VirtualLocation", url: `${site.url}${input.path}` },
  };
}
