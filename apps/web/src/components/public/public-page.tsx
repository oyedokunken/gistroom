import type { ReactNode } from "react";
import { Footer } from "@/components/landing/footer";
import { VoiceDock } from "@/components/landing/voice-dock";
import { jsonLdString } from "@/lib/jsonld";

/**
 * The public header and footer, applied per page and never from a layout. A page that calls notFound()
 * therefore renders the standalone 404 with none of this chrome, even if it got there by mistake.
 */
export function PublicPage({ children, jsonLd }: { children: ReactNode; jsonLd?: unknown[] }) {
  return (
    <>
      <VoiceDock />
      <main id="main">{children}</main>
      <Footer />
      {jsonLd?.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
        />
      ) : null}
    </>
  );
}
