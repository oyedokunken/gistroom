import type { Metadata } from "next";
import { Check } from "lucide-react";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { PublicPage } from "@/components/public/public-page";
import { CtaBand, HeroActions, PageHero } from "@/components/public/sections";
import { changelog } from "@/content/pages";
import { cta } from "@/content/marketing";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { loadChangelog } from "@/lib/changelog";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";

export const metadata: Metadata = pageMetadata({
  title: changelog.title,
  description: changelog.description,
  path: "/changelog",
});

const groupStyles: Record<string, string> = {
  added: "bg-green-600 text-white",
  changed: "bg-ink-950 text-white",
  fixed: "bg-yellow-400 text-ink-950",
};

const groupIcons: Record<string, CardIconName> = {
  added: "idea",
  changed: "switch",
  fixed: "tools",
};

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
      <PageHero
        title={changelog.title}
        lead={changelog.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: changelog.title, href: "/changelog" },
        ]}
        actions={<HeroActions primary={cta.enter} />}
      />

      <section aria-label={changelog.title} className="w-full">
        <ol className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-6 py-16 md:py-24">
          {entries.map((entry, i) => (
            <li
              key={entry.version + i}
              className="relative grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10"
            >
              {/* Version rail: big number on the left, line running down the page. */}
              <div className="relative md:pr-8">
                <span
                  aria-hidden
                  className="absolute -left-1 top-2 hidden size-3 rounded-full bg-green-600 ring-4 ring-green-600/15 md:block"
                />
                <span
                  aria-hidden
                  className="absolute left-[0.1875rem] top-8 hidden h-full w-px bg-border md:block"
                />
                <h2 className="text-2xl font-black tracking-[-0.02em] text-text md:text-3xl">
                  {entry.version}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {i === 0 ? (
                    <span className="inline-flex rounded-full bg-green-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
                      Latest
                    </span>
                  ) : null}
                  <span className="inline-flex rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-text-muted">
                    {entry.groups.reduce((n, g) => n + g.items.length, 0)} changes
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {entry.groups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <div key={g.label} className="rounded-hero bg-surface-2 p-6 md:p-8">
                      <div className="flex items-center gap-4">
                        <CardIcon name={groupIcons[g.label.toLowerCase()] ?? "idea"} />
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                            groupStyles[g.label.toLowerCase()] ?? "bg-green-600 text-white",
                          )}
                        >
                          {g.label}
                        </span>
                      </div>
                      <ul className="mt-5 flex flex-col gap-3 text-text-muted">
                        {g.items.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <Check
                              aria-hidden
                              className="mt-1 size-4 shrink-0 rounded-full bg-green-600/15 p-0.5 text-green-700"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand
        title={changelog.closing.title}
        body={changelog.closing.body}
        primary={cta.enter}
        secondary={cta.rooms}
        art="scene-football-centre"
        icon="speed"
      />
    </PublicPage>
  );
}
