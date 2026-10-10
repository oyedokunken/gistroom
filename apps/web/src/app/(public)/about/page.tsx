import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { ProsePage } from "@/components/public/prose-page";
import { about } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: about.title,
  description: about.description,
  path: "/about",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: about.title, path: "/about" },
        ]),
      ]}
    >
      <ProsePage
        title={about.title}
        lead={about.lead}

        sections={about.sections}
        crumbs={[
          { name: "Home", href: "/" },
          { name: about.title, href: "/about" },
        ]}
        cta={{ label: "Enter Gistroom", href: "/signup" }}
      />
    </PublicPage>
  );
}
