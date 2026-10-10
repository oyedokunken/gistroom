import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { CtaBand } from "@/components/public/sections";
import { privacy, legal } from "@/content/pages";
import { cta } from "@/content/marketing";
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
        cta={cta.enter}
        sections={privacy.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: privacy.title, href: "/privacy" },
        ]}
        after={
          <CtaBand
            title={privacy.closing.title}
            body={privacy.closing.body}
            primary={cta.enter}
            secondary={cta.rooms}
            art="scene-suya"
            icon="privacy"
          />
        }
      />
    </PublicPage>
  );
}
