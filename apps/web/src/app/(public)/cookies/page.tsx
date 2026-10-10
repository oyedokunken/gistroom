import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { CtaBand } from "@/components/public/sections";
import { cookies, legal } from "@/content/pages";
import { cta } from "@/content/marketing";
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
        cta={cta.enter}
        sections={cookies.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: cookies.title, href: "/cookies" },
        ]}
        after={
          <CtaBand
            title={cookies.closing.title}
            body={cookies.closing.body}
            primary={cta.enter}
            secondary={cta.rooms}
            art="scene-street-football"
            icon="theme"
          />
        }
      />
    </PublicPage>
  );
}
