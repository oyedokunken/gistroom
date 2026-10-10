import type { Metadata } from "next";
import { ProsePage } from "@/components/public/prose-page";
import { PublicPage } from "@/components/public/public-page";
import { changelog } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { loadChangelog } from "@/lib/changelog";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: changelog.title,
  description: changelog.description,
  path: "/changelog",
});

export default function ChangelogPage() {
  const entries = loadChangelog();
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: changelog.title, path: "/changelog" },
        ]),
      ]}
    >
      <ProsePage
        title={changelog.title}
        lead={changelog.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: changelog.title, href: "/changelog" },
        ]}
        sections={entries.map((e, i) => ({
          id: `v${i}`,
          heading: e.version,
          extra: (
            <div className="mt-3 flex flex-col gap-4">
              {e.groups
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.label}>
                    <h3 className="font-semibold text-text">{g.label}</h3>
                    <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-text-muted">
                      {g.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ),
        }))}
      />
    </PublicPage>
  );
}
