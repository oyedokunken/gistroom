import type { Metadata } from "next";
import { ContactForm } from "@/components/public/contact-form";
import { Faq } from "@/components/public/faq";
import { ProsePage } from "@/components/public/prose-page";
import { PublicPage } from "@/components/public/public-page";
import { faqItems, support, troubleshooting } from "@/content/pages";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: support.title,
  description: support.description,
  path: "/support",
});

export default function SupportPage() {
  const all = [...faqItems, ...troubleshooting];
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: support.title, path: "/support" },
        ]),
        faqJsonLd(all),
      ]}
    >
      <ProsePage
        title={support.title}
        lead={support.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: support.title, href: "/support" },
        ]}
        sections={[
          {
            id: "faq",
            heading: support.faqHeading,
            extra: (
              <div className="mt-4">
                <Faq items={faqItems} />
              </div>
            ),
          },
          {
            id: "troubleshooting",
            heading: support.troubleHeading,
            extra: (
              <div className="mt-4">
                <Faq items={troubleshooting} />
              </div>
            ),
          },
          {
            id: "contact",
            heading: support.contactHeading,
            extra: (
              <div className="mt-4">
                <ContactForm />
              </div>
            ),
          },
        ]}
      />
    </PublicPage>
  );
}
