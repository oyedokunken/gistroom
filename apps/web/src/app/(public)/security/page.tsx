import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { security } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: security.title,
  description: security.description,
  path: "/security",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: security.title, path: "/security" },
        ]),
      ]}
    >
      <ProsePage
        title={security.title}
        lead={security.lead}

        sections={security.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: security.title, href: "/security" },
        ]}
        cta={{ label: "Enter Gistroom", href: "/signup" }}
      />
    </PublicPage>
  );
}
