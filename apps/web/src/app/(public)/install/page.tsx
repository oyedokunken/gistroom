import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { install } from "@/content/pages";
import { breadcrumbJsonLd, softwareAppJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: install.title,
  description: install.description,
  path: "/install",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: install.title, path: "/install" },
        ]),
        softwareAppJsonLd(),
      ]}
    >
      <ProsePage
        title={install.title}
        lead={install.lead}

        sections={install.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: install.title, href: "/install" },
        ]}
        cta={{ label: "Enter Gistroom", href: "/signup" }}
      />
    </PublicPage>
  );
}
