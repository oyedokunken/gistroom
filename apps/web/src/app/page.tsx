import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { VoiceDock } from "@/components/landing/voice-dock";
import { home } from "@/content/site";
import { jsonLdString, organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: { absolute: home.title },
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <VoiceDock />
      <main>
        <Hero />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([organizationJsonLd(), websiteJsonLd()]),
        }}
      />
    </>
  );
}
