import type { ReactNode } from "react";
import { HeroActions, PageHero } from "./sections";

export interface Section {
  id: string;
  heading: string;
  body?: readonly string[];
  bullets?: readonly string[];
  /** Extra content such as a form or a table, rendered after the text. */
  extra?: ReactNode;
}

export interface ProsePageProps {
  title: string;
  lead: string;
  updated?: string;
  sections: readonly Section[];
  cta?: { label: string; href: string };
  crumbs?: readonly { name: string; href: string }[];
  before?: ReactNode;
  after?: ReactNode;
}

/**
 * Long form public page: a full width hero, then a contents list that stays in view beside the sections.
 * Text lines stay under 80 characters, the page itself uses the full 1200 pixel column.
 */
export function ProsePage({
  title,
  lead,
  updated,
  sections,
  cta,
  crumbs,
  before,
  after,
}: ProsePageProps) {
  return (
    <>
      <PageHero
        title={title}
        lead={updated ? `${lead} ${updated}` : lead}
        crumbs={crumbs}
        actions={cta ? <HeroActions primary={cta} /> : undefined}
      />
      {before}
      <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-6 py-16 md:py-24 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-20">
        {sections.length > 2 ? (
          <nav aria-label="On this page" className="hidden lg:block">
            <ul className="sticky top-28 flex flex-col gap-1 border-l-2 border-border">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-0.5 flex min-h-11 items-center border-l-2 border-transparent py-1 pl-4 text-sm font-medium text-text-muted hover:border-green-600 hover:text-text"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div
          className={`flex flex-col gap-14 ${sections.length > 2 ? "" : "lg:col-span-2 lg:max-w-[52rem]"}`}
        >
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
              <h2
                id={`${s.id}-h`}
                className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] text-text"
              >
                {s.heading}
              </h2>
              {s.body?.map((p) => (
                <p key={p} className="mt-4 max-w-[68ch] text-lg text-text-muted">
                  {p}
                </p>
              ))}
              {s.bullets ? (
                <ul className="mt-4 flex max-w-[68ch] list-disc flex-col gap-2.5 pl-5 text-lg text-text-muted marker:text-green-600">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {s.extra}
            </section>
          ))}
        </div>
      </div>
      {after}
    </>
  );
}
