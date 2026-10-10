import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { PublicPage } from "@/components/public/public-page";
import { home } from "@/content/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: { absolute: home.title },
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <PublicPage jsonLd={[organizationJsonLd(), websiteJsonLd()]}>
      <Hero />
    </PublicPage>
  );
}
