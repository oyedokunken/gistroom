import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { features } from "@/content/pages";
import { breadcrumbJsonLd, softwareAppJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: features.title,
  description: features.description,
  path: "/features",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: features.title, path: "/features" },
        ]),
        softwareAppJsonLd(),
      ]}
    >
      <ProsePage
        title={features.title}
        lead={features.lead}

        sections={features.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: features.title, href: "/features" },
        ]}
        cta={{ label: "Enter Gistroom", href: "/signup" }}
      />
    </PublicPage>
  );
}
