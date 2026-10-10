import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { terms, legal } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: terms.title,
  description: terms.description,
  path: "/terms",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: terms.title, path: "/terms" },
        ]),
      ]}
    >
      <ProsePage
        title={terms.title}
        lead={terms.lead}
        updated={legal.updated}
        sections={terms.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: terms.title, href: "/terms" },
        ]}
        after={<p className="mt-12 max-w-[44rem] text-sm text-text-muted">{legal.draftNote}</p>}
      />
    </PublicPage>
  );
}
