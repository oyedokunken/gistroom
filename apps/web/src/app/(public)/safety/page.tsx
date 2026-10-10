import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { safety } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: safety.title,
  description: safety.description,
  path: "/safety",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: safety.title, path: "/safety" },
        ]),
      ]}
    >
      <ProsePage
        title={safety.title}
        lead={safety.lead}

        sections={safety.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: safety.title, href: "/safety" },
        ]}
        cta={{ label: "Enter Gistroom", href: "/signup" }}
      />
    </PublicPage>
  );
}
