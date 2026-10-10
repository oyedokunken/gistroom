import type { Metadata } from "next";
import { ContactForm } from "@/components/public/contact-form";
import { CtaBand } from "@/components/public/sections";
import { Faq } from "@/components/public/faq";
import { ProsePage } from "@/components/public/prose-page";
import { PublicPage } from "@/components/public/public-page";
import { faqItems, support, troubleshooting } from "@/content/pages";
import { cta } from "@/content/marketing";
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
            id: "contact",
            icon: "invites",
            heading: support.contactHeading,
            extra: (
              <div className="mt-4">
                <ContactForm />
              </div>
            ),
          },
          {
            id: "faq",
            icon: "open-gist",
            heading: support.faqHeading,
            extra: (
              <div className="mt-4">
                <Faq items={faqItems} />
              </div>
            ),
          },
          {
            id: "troubleshooting",
            icon: "tools",
            heading: support.troubleHeading,
            extra: (
              <div className="mt-4">
                <Faq items={troubleshooting} name="troubleshooting" />
              </div>
            ),
          },
        ]}
        after={
          <CtaBand
            title={support.closing.title}
            body={support.closing.body}
            primary={cta.enter}
            art="scene-help-desk"
            icon="invites"
          />
        }
      />
    </PublicPage>
  );
}
