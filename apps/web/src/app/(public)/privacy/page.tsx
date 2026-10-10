import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { privacy, legal } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: privacy.title,
  description: privacy.description,
  path: "/privacy",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: privacy.title, path: "/privacy" },
        ]),
      ]}
    >
      <ProsePage
        title={privacy.title}
        lead={privacy.lead}
        updated={legal.updated}
        sections={privacy.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: privacy.title, href: "/privacy" },
        ]}
        after={<p className="mt-12 max-w-[44rem] text-sm text-text-muted">{legal.draftNote}</p>}
      />
    </PublicPage>
  );
}
