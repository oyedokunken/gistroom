import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { CtaBand } from "@/components/public/sections";
import { acceptableUse, legal } from "@/content/pages";
import { cta } from "@/content/marketing";
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
        cta={cta.enter}
        sections={acceptableUse.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: acceptableUse.title, href: "/acceptable-use" },
        ]}
        after={
          <CtaBand
            title={acceptableUse.closing.title}
            body={acceptableUse.closing.body}
            primary={cta.enter}
            secondary={cta.rooms}
            art="scene-door-check"
            icon="shield-slash"
          />
        }
      />
    </PublicPage>
  );
}
