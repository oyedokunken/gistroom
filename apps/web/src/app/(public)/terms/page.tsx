import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { CtaBand } from "@/components/public/sections";
import { terms, legal } from "@/content/pages";
import { cta } from "@/content/marketing";
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
        cta={cta.enter}
        sections={terms.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: terms.title, href: "/terms" },
        ]}
        after={
          <CtaBand
            title={terms.closing.title}
            body={terms.closing.body}
            primary={cta.enter}
            secondary={cta.rooms}
            art="scene-keke"
            icon="law"
          />
        }
      />
    </PublicPage>
  );
}
