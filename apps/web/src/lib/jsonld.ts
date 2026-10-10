import { site } from "@/content/site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/icon-512.png`,
    parentOrganization: { "@type": "Organization", name: "Rexta Technologies" },
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
