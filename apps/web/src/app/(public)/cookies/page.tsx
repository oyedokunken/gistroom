import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { cookies, legal } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: cookies.title,
  description: cookies.description,
  path: "/cookies",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: cookies.title, path: "/cookies" },
        ]),
      ]}
    >
      <ProsePage
        title={cookies.title}
        lead={cookies.lead}
        updated={legal.updated}
        sections={cookies.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: cookies.title, href: "/cookies" },
        ]}
        after={<p className="mt-12 max-w-[44rem] text-sm text-text-muted">{legal.draftNote}</p>}
      />
    </PublicPage>
  );
}
