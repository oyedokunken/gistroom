import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { acceptableUse, legal } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: acceptableUse.title,
  description: acceptableUse.description,
  path: "/acceptable-use",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: acceptableUse.title, path: "/acceptable-use" },
        ]),
      ]}
    >
      <ProsePage
        title={acceptableUse.title}
        lead={acceptableUse.lead}
        updated={legal.updated}
        sections={acceptableUse.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: acceptableUse.title, href: "/acceptable-use" },
        ]}
        after={<p className="mt-12 max-w-[44rem] text-sm text-text-muted">{legal.draftNote}</p>}
      />
    </PublicPage>
  );
}
